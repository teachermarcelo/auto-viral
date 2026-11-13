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
  return Number.isFinite(n) && n >= 0 ? (n > 99999 ? n / 100 : n) : null;
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!/^[a-f0-9]{64}$/i.test(token)) return json({ error: "Webhook token ausente ou inválido." }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
  if (!supabaseUrl || !serviceKey) return json({ error: "Backend indisponível." }, 503);
  let body: Record<string, any>;
  try { body = obj(await req.json()); } catch { return json({ error: "JSON inválido." }, 400); }
  const orderId = String(pick(body.order_id, body.orderId, body.order_ref, body.id) || "");
  if (!orderId || orderId.length > 180) return json({ error: "Evento sem identificador de pedido." }, 400);
  const statusRaw = norm(pick(body.order_status, body.status, body.event, body.type));
  const statusMap: Record<string, string> = {
    paid: "paid", approved: "approved", aprovada: "approved",
    "pagamento aprovado": "approved", "waiting payment": "waiting_payment",
    pending: "waiting_payment", "aguardando pagamento": "waiting_payment",
    refused: "refused", rejected: "refused", recusada: "refused",
    refunded: "refunded", refund: "refunded", reembolsada: "refunded",
    chargedback: "chargedback", chargeback: "chargedback",
    canceled: "canceled", cancelled: "canceled", cancelada: "canceled"
  };
  const orderStatus = statusMap[statusRaw] || "unknown";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  const tokenHash = [...digest].map(b => b.toString(16).padStart(2, "0")).join("");
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: secret, error: secretError } = await admin.from("av_kiwify_webhook_secrets").select("workspace_id").eq("token_hash", tokenHash).eq("active", true).maybeSingle();
  if (secretError || !secret) return json({ error: "Webhook não autorizado." }, 401);
  const productObj = obj(pick(body.Product, body.product, body.product_data));
  const productName = String(pick(productObj.product_name, productObj.name, body.product_name, body.productName) || "");
  const productExternalId = String(pick(productObj.product_id, productObj.id, body.product_id) || "");
  const { data: products, error: productError } = await admin.from("av_products").select("id,name,price").eq("workspace_id", secret.workspace_id);
  if (productError) return json({ error: "Não foi possível localizar os produtos." }, 500);
  const product = (products || []).find((p: any) => norm(p.name) === norm(productName)) || null;
  let campaign: any = null;
  if (product) {
    const { data } = await admin.from("av_campaigns").select("id").eq("workspace_id", secret.workspace_id).eq("product_id", product.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    campaign = data;
  }
  const commissions = obj(body.Commissions || body.commissions);
  const total = amount(pick(body.order_amount, body.total, body.amount, body.value, commissions.charge_amount, product?.price));
  const currency = String(pick(body.currency, commissions.currency, "BRL")).slice(0, 8);
  const paymentMethod = String(pick(body.payment_method, body.paymentMethod) || "").slice(0, 60) || null;
  const paidAt = ["paid", "approved"].includes(orderStatus) ? pick(body.approved_at, body.paid_at, body.created_at) || new Date().toISOString() : null;
  const metadata = {
    source: "kiwify_webhook",
    product_name: productName.slice(0, 180) || null,
    product_external_id: productExternalId.slice(0, 120) || null,
    checkout_link: String(pick(body.checkout_link, body.checkoutLink) || "").slice(0, 180) || null,
    event: String(pick(body.event, body.type) || "").slice(0, 80) || null
  };
  const { data: sale, error: saleError } = await admin.from("av_sales").upsert({
    workspace_id: secret.workspace_id, product_id: product?.id || null, campaign_id: campaign?.id || null,
    provider: "kiwify", provider_order_id: orderId, order_status: orderStatus, amount: total,
    currency, payment_method: paymentMethod, paid_at: paidAt, metadata
  }, { onConflict: "provider,provider_order_id" }).select("id,order_status,product_id").single();
  if (saleError) {
    console.error("av-kiwify-webhook", saleError.message);
    return json({ error: "Não foi possível registrar a venda." }, 500);
  }
  return json({ ok: true, received: true, sale_id: sale.id, status: sale.order_status, product_matched: Boolean(sale.product_id) });
});