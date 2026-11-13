import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const pick = (...values: unknown[]) => values.find(v => v !== undefined && v !== null && String(v).trim() !== "");
const obj = (v: unknown): Record<string, any> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {};
const amount = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const signature = new URL(req.url).searchParams.get("signature") || "";
  if (!/^[a-f0-9]{40}$/i.test(signature)) return json({ error: "Assinatura Kiwify ausente ou inválida." }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
  if (!supabaseUrl || !serviceKey) return json({ error: "Backend indisponível." }, 503);
  const rawBody = await req.text();
  let body: Record<string, any>;
  try { body = obj(JSON.parse(rawBody)); } catch { return json({ error: "JSON inválido." }, 400); }
  const orderId = String(pick(body.order_id, body.orderId, body.order_ref, body.id) || "");
  if (!orderId || orderId.length > 180) return json({ error: "Evento sem identificador de pedido." }, 400);
  const statusRaw = norm(pick(body.order_status, body.status, body.event, body.type));
  const statusMap: Record<string, string> = {
    paid: "paid", approved: "approved", authorized: "authorized", processing: "processing", aprovada: "approved",
    "pagamento aprovado": "approved", "waiting payment": "waiting_payment",
    pending: "waiting_payment", "aguardando pagamento": "waiting_payment",
    refused: "refused", rejected: "refused", recusada: "refused",
    refunded: "refunded", refund: "refunded", reembolsada: "refunded", "pending refund": "pending_refund", "refund requested": "refund_requested",
    chargedback: "chargedback", chargeback: "chargedback",
    canceled: "canceled", cancelled: "canceled", cancelada: "canceled"
  };
  const orderStatus = statusMap[statusRaw] || "unknown";
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: workspaceId, error: signatureError } = await admin.rpc("av_verify_kiwify_webhook", {
    p_signature: signature.toLowerCase(), p_raw_body: rawBody, p_canonical_body: JSON.stringify(body)
  });
  if (signatureError || !workspaceId) return json({ error: "Assinatura Kiwify não confere." }, 401);
  const secret = { workspace_id: workspaceId };
  const productObj = obj(pick(body.Product, body.product, body.product_data));
  const productName = String(pick(productObj.product_name, productObj.name, body.product_name, body.productName) || "");
  const productExternalId = String(pick(productObj.product_id, productObj.id, body.product_id) || "");
  const { data: products, error: productError } = await admin.from("av_products").select("id,name,price,checkout_url,kiwify_product_id").eq("workspace_id", secret.workspace_id);
  if (productError) return json({ error: "Não foi possível localizar os produtos." }, 500);
  const checkoutCode = String(pick(body.checkout_link, body.checkoutLink) || "").split("/").pop()?.split("?")[0] || "";
  const product = (products || []).find((p: any) => productExternalId && p.kiwify_product_id === productExternalId)
    || (products || []).find((p: any) => norm(p.name) === norm(productName))
    || (products || []).find((p: any) => {
      try { return checkoutCode && new URL(p.checkout_url).pathname.slice(1) === checkoutCode; } catch { return false; }
    }) || null;
  const tracking = obj(body.TrackingParameters || body.tracking_parameters);
  const utmCampaign = String(tracking.utm_campaign || "").trim();
  const utmContent = String(tracking.utm_content || "").trim();
  let trackingLink: any = null;
  if (utmContent) {
    const { data } = await admin.from("av_tracking_links").select("id,campaign_id").eq("workspace_id", secret.workspace_id).eq("code", utmContent).maybeSingle();
    trackingLink = data;
  }
  let campaign: any = null;
  if (utmCampaign) {
    const { data } = await admin.from("av_campaigns").select("id").eq("workspace_id", secret.workspace_id).eq("id", utmCampaign).maybeSingle();
    campaign = data;
  }
  if (!campaign && trackingLink?.campaign_id) {
    const { data } = await admin.from("av_campaigns").select("id").eq("workspace_id", secret.workspace_id).eq("id", trackingLink.campaign_id).maybeSingle();
    campaign = data;
  }
  if (!campaign && product) {
    const { data } = await admin.from("av_campaigns").select("id").eq("workspace_id", secret.workspace_id).eq("product_id", product.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    campaign = data;
  }
  const commissions = obj(body.Commissions || body.commissions);
  const directAmount = amount(pick(body.order_amount, body.total, body.amount, body.value));
  const commissionChargeCents = amount(commissions.charge_amount);
  const total = directAmount ?? (commissionChargeCents !== null ? commissionChargeCents / 100 : amount(product?.price));
  const currency = String(pick(body.currency, commissions.currency, "BRL")).slice(0, 8);
  const paymentMethod = String(pick(body.payment_method, body.paymentMethod) || "").slice(0, 60) || null;
  const paidAt = ["paid", "approved"].includes(orderStatus) ? pick(body.approved_date, body.approved_at, body.paid_at, body.created_at) || new Date().toISOString() : null;
  const metadata = {
    source: "kiwify_webhook",
    product_name: productName.slice(0, 180) || null,
    product_external_id: productExternalId.slice(0, 120) || null,
    checkout_link: String(pick(body.checkout_link, body.checkoutLink) || "").slice(0, 180) || null,
    event: String(pick(body.webhook_event_type, body.event, body.type) || "").slice(0, 80) || null,
    utm_source: String(tracking.utm_source || "").slice(0, 80) || null,
    utm_medium: String(tracking.utm_medium || "").slice(0, 80) || null,
    utm_campaign: utmCampaign.slice(0, 80) || null,
    utm_content: utmContent.slice(0, 80) || null
  };
  const { data: sale, error: saleError } = await admin.from("av_sales").upsert({
    workspace_id: secret.workspace_id, product_id: product?.id || null, campaign_id: campaign?.id || null, tracking_link_id: trackingLink?.id || null,
    provider: "kiwify", provider_order_id: orderId, order_status: orderStatus, amount: total,
    currency, payment_method: paymentMethod, paid_at: paidAt, metadata
  }, { onConflict: "provider,provider_order_id" }).select("id,order_status,product_id").single();
  if (saleError) {
    console.error("av-kiwify-webhook", saleError.message);
    return json({ error: "Não foi possível registrar a venda." }, 500);
  }
  return json({ ok: true, received: true, sale_id: sale.id, status: sale.order_status, product_matched: Boolean(sale.product_id) });
});