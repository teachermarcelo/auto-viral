import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONSENT_TEXT = "Autorizo o contato sobre este material ou serviço e concordo com o uso dos dados informados para retorno da solicitação. Posso solicitar a interrupção do contato.";
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}
function page(title: string, body: string, status = 200) {
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#100f18;color:#f7f4ff;font:16px/1.5 Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:20px}.card{width:min(100%,480px);background:#1b1827;border:1px solid #393249;border-radius:18px;padding:26px;box-shadow:0 18px 60px #0005}.brand{color:#c4b5fd;font-size:12px;letter-spacing:2px;font-weight:bold}.card h1{font-size:25px;margin:12px 0}.muted{color:#b7afc5;font-size:13px}.field{display:grid;gap:6px;margin:14px 0;font-size:13px}.field input{width:100%;padding:12px;border:1px solid #514765;border-radius:9px;background:#100f18;color:white;font:inherit}.consent{display:flex;gap:10px;align-items:flex-start;color:#c9c2d4;font-size:12px;margin:16px 0}.consent input{margin-top:4px}.btn{width:100%;border:0;border-radius:9px;padding:13px;background:#8055e9;color:white;font-weight:bold;font-size:14px;cursor:pointer}.privacy{font-size:10px;color:#938ba1;margin-top:14px}.trap{position:absolute;left:-10000px;opacity:0}
  </style></head><body><main class="card"><div class="brand">AUTOVIRAL AI</div>${body}<p class="privacy">Seus dados serão usados somente para responder ao seu pedido. Não compartilhe informações sensíveis.</p></main></body></html>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const url = new URL(req.url);
  const code = (url.searchParams.get("c") ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{6,40}$/.test(code)) return page("Link inválido", "<h1>Link inválido</h1><p class='muted'>Verifique o endereço e tente novamente.</p>", 404);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return page("Indisponível", "<h1>Formulário temporariamente indisponível</h1>", 503);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: link, error } = await admin.from("av_tracking_links")
    .select("id,workspace_id,campaign_id,destination_url,label").eq("code", code).maybeSingle();
  if (error || !link) return page("Link não encontrado", "<h1>Link não encontrado</h1>", 404);

  let destination: URL;
  try {
    destination = new URL(link.destination_url);
    if (!["https:", "http:"].includes(destination.protocol)) throw new Error("bad protocol");
  } catch {
    return page("Destino inválido", "<h1>Este link possui um destino inválido.</h1>", 400);
  }

  if (req.method === "GET") {
    const ua = req.headers.get("user-agent") ?? "";
    const device = /mobile|android|iphone/i.test(ua) ? "mobile" : /tablet|ipad/i.test(ua) ? "tablet" : "desktop";
    let referrerHost: string | null = null;
    try { const ref = req.headers.get("referer"); referrerHost = ref ? new URL(ref).hostname : null; } catch { /* ignore */ }
    await admin.from("av_tracking_events").insert({
      workspace_id: link.workspace_id, tracking_link_id: link.id, event_type: "click",
      referrer_host: referrerHost, device_type: device,
    });
    const title = link.label || "Receba mais informações";
    const body = `<h1>${escapeHtml(title)}</h1><p class="muted">Preencha os dados abaixo para continuar. Os campos de contato são usados somente para responder à sua solicitação.</p>
    <form method="POST" action="${escapeHtml(req.url)}">
      <label class="field">Seu nome *<input name="name" required minlength="2" maxlength="180" autocomplete="name"></label>
      <label class="field">E-mail<input name="email" type="email" maxlength="254" autocomplete="email"></label>
      <label class="field">WhatsApp com DDD<input name="whatsapp" type="tel" maxlength="32" autocomplete="tel"></label>
      <label class="field">Cidade (opcional)<input name="city" maxlength="120" autocomplete="address-level2" placeholder="Ex.: Itaperuçu - PR"></label>
      <label class="trap">Não preencher<input name="website" tabindex="-1" autocomplete="off"></label>
      <label class="consent"><input type="checkbox" name="consent" value="yes" required><span>${CONSENT_TEXT}</span></label>
      <button class="btn" type="submit">Enviar e continuar</button>
    </form>`;
    return page(title, body);
  }

  const form = await req.formData();
  if (String(form.get("website") ?? "").trim()) return page("Solicitação inválida", "<h1>Não foi possível processar o formulário.</h1>", 400);
  if (form.get("consent") !== "yes") return page("Consentimento necessário", "<h1>É necessário autorizar o contato para enviar.</h1>", 400);
  const name = String(form.get("name") ?? "").trim().slice(0, 180);
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const whatsapp = String(form.get("whatsapp") ?? "").trim().slice(0, 32);
  const city = String(form.get("city") ?? "").trim().slice(0, 120);
  if (name.length < 2 || (!email && !whatsapp) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return page("Confira os dados", "<h1>Confira os dados</h1><p class='muted'>Informe seu nome e pelo menos um contato válido: e-mail ou WhatsApp.</p>", 400);
  }

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin.from("av_leads").select("id", { count: "exact", head: true })
    .eq("tracking_link_id", link.id).gte("created_at", since);
  if ((count ?? 0) >= 20) return page("Tente novamente", "<h1>Recebemos muitas solicitações neste momento.</h1><p class='muted'>Tente novamente mais tarde.</p>", 429);

  const { error: insertError } = await admin.from("av_leads").insert({
    workspace_id: link.workspace_id,
    campaign_id: link.campaign_id,
    tracking_link_id: link.id,
    name, email: email || null, whatsapp: whatsapp || null, city: city || null,
    consent_at: new Date().toISOString(),
    consent_text: CONSENT_TEXT,
  });
  if (insertError) return page("Erro ao enviar", "<h1>Não foi possível registrar sua solicitação.</h1><p class='muted'>Tente novamente em instantes.</p>", 500);

  await admin.from("av_tracking_events").insert({
    workspace_id: link.workspace_id,
    tracking_link_id: link.id,
    event_type: "lead",
    city: city || null,
  });
  destination.searchParams.set("utm_source", "autoviral");
  destination.searchParams.set("utm_medium", "lead_form");
  if (link.campaign_id) destination.searchParams.set("utm_campaign", link.campaign_id);
  return Response.redirect(destination.toString(), 303);
});
