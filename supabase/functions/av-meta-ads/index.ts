import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "https://teachermarcelo.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const graph = "https://graph.facebook.com/v24.0";

async function decrypt(ciphertext: string, secret: string): Promise<string> {
  const material = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret + "|autoviral-meta-token-v1"),
  );
  const key = await crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["decrypt"]);
  const bytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const encrypted = bytes.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return new TextDecoder().decode(plain);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const jwt = authorization.replace(/^Bearer\s+/i, "");
    if (!jwt || jwt === authorization) return reply({ error: "UNAUTHORIZED" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
    const appSecret = Deno.env.get("META_APP_SECRET");
    if (!supabaseUrl || !serviceKey || !appSecret) {
      return reply({ error: "BACKEND_NOT_CONFIGURED", message: "Configure os secrets do Supabase e META_APP_SECRET." }, 503);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !user) return reply({ error: "INVALID_SESSION" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list_campaigns");
    const workspaceId = String(body.workspace_id || "");
    const adAccountId = String(body.ad_account_id || "");
    const campaignId = String(body.campaign_id || "");

    if (!workspaceId) return reply({ error: "WORKSPACE_REQUIRED" }, 400);
    const { data: membership } = await admin.from("av_workspace_members")
      .select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).maybeSingle();
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return reply({ error: "FORBIDDEN", message: "Somente owner ou admin pode gerenciar campanhas Meta." }, 403);
    }

    const { data: connection, error: connectionError } = await admin.from("av_meta_connections")
      .select("user_token_ciphertext,ad_accounts,scopes,status")
      .eq("workspace_id", workspaceId).eq("status", "connected").maybeSingle();
    if (connectionError || !connection) {
      return reply({ error: "META_NOT_CONNECTED", message: "Conecte uma conta Meta em Integrações antes de continuar." }, 409);
    }

    const scopes: string[] = connection.scopes || [];
    if (!scopes.includes("ads_read")) {
      return reply({ error: "ADS_READ_PERMISSION_REQUIRED", message: "Reconecte a Meta e autorize ads_read." }, 403);
    }
    const token = await decrypt(connection.user_token_ciphertext, appSecret);
    const accounts = Array.isArray(connection.ad_accounts) ? connection.ad_accounts : [];

    if (action === "list_accounts") {
      return reply({ status: "CONNECTED", ad_accounts: accounts, scopes });
    }

    const normalizedAccount = adAccountId.replace(/^act_/, "");
    const selectedAccount = accounts.find((a: any) => String(a.id || "").replace(/^act_/, "") === normalizedAccount);
    if (!selectedAccount) return reply({ error: "AD_ACCOUNT_NOT_AUTHORIZED", message: "A conta de anúncios não pertence aos ativos autorizados nesta conexão." }, 403);

    const accountPath = "act_" + normalizedAccount;
    if (action === "list_campaigns") {
      const url = new URL(`${graph}/${accountPath}/campaigns`);
      url.searchParams.set("fields", "id,name,status,effective_status,objective,daily_budget,lifetime_budget,created_time,updated_time");
      url.searchParams.set("limit", "100");
      const response = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      const payload = await response.json();
      if (!response.ok) return reply({ error: "META_API_ERROR", message: payload?.error?.message || "Falha ao consultar campanhas.", code: payload?.error?.code ?? null }, 502);
      return reply({ status: "OK", ad_account: selectedAccount, campaigns: payload.data || [], source: "meta_marketing_api" });
    }

    if (!["pause", "activate", "delete"].includes(action)) return reply({ error: "INVALID_ACTION" }, 400);
    if (!campaignId || !/^\d+$/.test(campaignId)) return reply({ error: "INVALID_CAMPAIGN_ID" }, 400);
    if (!scopes.includes("ads_management")) {
      return reply({ error: "ADS_MANAGEMENT_PERMISSION_REQUIRED", message: "Reconecte a Meta e autorize ads_management." }, 403);
    }

    const beforeUrl = new URL(`${graph}/${campaignId}`);
    beforeUrl.searchParams.set("fields", "id,name,status,effective_status,account_id");
    const beforeResponse = await fetch(beforeUrl, { headers: { Authorization: "Bearer " + token } });
    const before = await beforeResponse.json();
    if (!beforeResponse.ok || String(before.account_id || "") !== normalizedAccount) {
      return reply({ error: "CAMPAIGN_NOT_IN_SELECTED_ACCOUNT", message: "Campanha não encontrada ou não pertence à conta selecionada." }, 404);
    }

    let mutationResponse: Response;
    let mutationPayload: any;
    if (action === "delete") {
      const deleteUrl = new URL(`${graph}/${campaignId}`);
      mutationResponse = await fetch(deleteUrl, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
      mutationPayload = await mutationResponse.json();
    } else {
      const updateUrl = new URL(`${graph}/${campaignId}`);
      const params = new URLSearchParams({ status: action === "pause" ? "PAUSED" : "ACTIVE" });
      mutationResponse = await fetch(updateUrl, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/x-www-form-urlencoded" }, body: params });
      mutationPayload = await mutationResponse.json();
    }

    let verified = false;
    let verifiedStatus: string | null = null;
    if (mutationResponse.ok && action !== "delete") {
      const verifyUrl = new URL(`${graph}/${campaignId}`);
      verifyUrl.searchParams.set("fields", "id,name,status,effective_status");
      const verifyResponse = await fetch(verifyUrl, { headers: { Authorization: "Bearer " + token } });
      const verifyPayload = await verifyResponse.json();
      verifiedStatus = verifyPayload?.status || null;
      verified = verifyResponse.ok && verifiedStatus === (action === "pause" ? "PAUSED" : "ACTIVE");
    } else if (mutationResponse.ok && action === "delete") {
      const verifyUrl = new URL(`${graph}/${accountPath}/campaigns`);
      verifyUrl.searchParams.set("fields", "id");
      verifyUrl.searchParams.set("filtering", JSON.stringify([{ field: "id", operator: "EQUAL", value: campaignId }]));
      verifyUrl.searchParams.set("limit", "10");
      const verifyResponse = await fetch(verifyUrl, { headers: { Authorization: "Bearer " + token } });
      const verifyPayload = await verifyResponse.json();
      verified = verifyResponse.ok && !(verifyPayload.data || []).some((item: any) => String(item.id) === campaignId);
      verifiedStatus = verified ? "NOT_FOUND_IN_ACCOUNT" : "STILL_PRESENT_OR_UNVERIFIED";
    }

    const requestStatus = mutationResponse.ok ? "success" : "failed";
    await admin.from("av_meta_action_logs").insert({
      workspace_id: workspaceId,
      ad_account_id: accountPath,
      meta_campaign_id: campaignId,
      campaign_name: before.name || null,
      action,
      requested_by: user.id,
      request_status: requestStatus,
      verified,
      verified_status: verifiedStatus,
      meta_response: {
        http_status: mutationResponse.status,
        success: mutationPayload?.success === true || mutationResponse.ok,
        error_code: mutationPayload?.error?.code ?? null,
        error_message: mutationPayload?.error?.message ?? null,
      },
    });

    if (!mutationResponse.ok) {
      return reply({ error: "META_ACTION_FAILED", message: mutationPayload?.error?.message || "A Meta recusou a operação.", code: mutationPayload?.error?.code ?? null, verified: false }, 502);
    }
    return reply({
      status: verified ? "CONFIRMED" : "REQUEST_ACCEPTED_UNVERIFIED",
      action,
      campaign_id: campaignId,
      campaign_name: before.name || null,
      verified,
      verified_status: verifiedStatus,
      meta_response: mutationPayload,
    });
  } catch (error) {
    console.error("av-meta-ads", error instanceof Error ? error.message : String(error));
    return reply({ error: "INTERNAL_ERROR", message: "Falha ao processar operação Meta." }, 500);
  }
});