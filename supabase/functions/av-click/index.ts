import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = (url.searchParams.get("c") ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{6,40}$/.test(code)) {
    return new Response("Link inválido.", { status: 404, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response("Rastreamento temporariamente indisponível.", { status: 503, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: link, error } = await admin
    .from("av_tracking_links")
    .select("id,workspace_id,campaign_id,destination_url")
    .eq("code", code)
    .maybeSingle();

  if (error || !link) {
    return new Response("Link não encontrado.", { status: 404, headers: corsHeaders });
  }

  let destination: URL;
  try {
    destination = new URL(link.destination_url);
    if (!["https:", "http:"].includes(destination.protocol)) throw new Error("unsupported");
  } catch {
    return new Response("Destino inválido.", { status: 400, headers: corsHeaders });
  }

  // Basic abuse guard: stop recording when one short link receives an unusual burst.
  // This is a tracking safeguard, not a platform rate-limit bypass.
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("av_tracking_events")
    .select("id", { count: "exact", head: true })
    .eq("tracking_link_id", link.id)
    .gte("created_at", since);

  if ((count ?? 0) < 240) {
    const ua = req.headers.get("user-agent") ?? "";
    const device = /mobile|android|iphone/i.test(ua)
      ? "mobile"
      : /tablet|ipad/i.test(ua) ? "tablet" : "desktop";
    const referrer = req.headers.get("referer");
    let referrerHost: string | null = null;
    try { referrerHost = referrer ? new URL(referrer).hostname : null; } catch { /* ignore malformed referrer */ }

    // Do not store IP addresses or infer a person's city from their IP.
    await admin.from("av_tracking_events").insert({
      workspace_id: link.workspace_id,
      tracking_link_id: link.id,
      event_type: "click",
      referrer_host: referrerHost,
      device_type: device,
    });
  }

  // Carry campaign and link IDs through Kiwify's documented TrackingParameters.
  // These UTMs allow the purchase webhook to attribute an approved order to its originating campaign.
  if (destination.hostname.toLowerCase() === "pay.kiwify.com.br") {
    if (link.campaign_id) destination.searchParams.set("utm_campaign", String(link.campaign_id));
    destination.searchParams.set("utm_source", "autoviral");
    destination.searchParams.set("src", "autoviral");
    destination.searchParams.set("sck", "av:" + String(link.campaign_id || "") + ":" + code);
    destination.searchParams.set("utm_medium", "organic");
    destination.searchParams.set("utm_content", code);
  }
  return Response.redirect(destination.toString(), 302);
});
