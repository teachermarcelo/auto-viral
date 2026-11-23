interface Env {
  META_CONNECTIONS: KVNamespace;
  META_APP_ID: string;
  META_APP_SECRET: string;
  TOKEN_ENCRYPTION_KEY: string;
  OAUTH_REDIRECT_URI: string;
  APP_ORIGIN: string;
  FIREBASE_PROJECT_ID: string;
  META_GRAPH_VERSION: string;
}

type FirebaseIdentity = { uid: string; email?: string };
type StoredConnection = { ciphertext: string; iv: string; connectedAt: string; expiresAt: string | null; metaUserId: string; metaUserName: string | null; scopes: string[] };
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const STATE_TTL_SECONDS = 600;
const GRAPH_TIMEOUT_MS = 15000;

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
function base64UrlEncode(value: Uint8Array): string {
  let binary = "";
  value.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function hexBytes(value: string): Uint8Array {
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error("TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters.");
  return Uint8Array.from(value.match(/.{2}/g)!, pair => parseInt(pair, 16));
}
function randomToken(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return base64UrlEncode(value);
}
function cors(request: Request, env: Env): Headers {
  const headers = new Headers({ "vary": "Origin", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "authorization, content-type" });
  const origin = request.headers.get("Origin");
  if (origin === env.APP_ORIGIN) headers.set("access-control-allow-origin", origin);
  return headers;
}
function withCors(response: Response, headers: Headers) {
  const merged = new Headers(response.headers);
  headers.forEach((value, key) => merged.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}
async function readFirebaseIdentity(request: Request, env: Env): Promise<FirebaseIdentity> {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("firebase_auth_required");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid_firebase_token");
  const headerData = JSON.parse(decoder.decode(base64UrlDecode(parts[0]))) as { alg?: string; kid?: string };
  const claims = JSON.parse(decoder.decode(base64UrlDecode(parts[1]))) as { aud?: string; iss?: string; sub?: string; exp?: number; iat?: number; auth_time?: number; email?: string };
  if (headerData.alg !== "RS256" || !headerData.kid) throw new Error("invalid_firebase_token");
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== env.FIREBASE_PROJECT_ID || claims.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` || !claims.sub || claims.sub.length > 128 || !claims.exp || claims.exp <= now || !claims.iat || claims.iat > now + 300) throw new Error("invalid_firebase_token");
  const keyResponse = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com", { cf: { cacheTtl: 3600, cacheEverything: true } } as RequestInit);
  if (!keyResponse.ok) throw new Error("firebase_key_lookup_failed");
  const keySet = await keyResponse.json() as { keys?: Array<JsonWebKey & { kid?: string }> };
  const jwk = keySet.keys?.find(key => key.kid === headerData.kid);
  if (!jwk) throw new Error("firebase_signing_key_not_found");
  const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const signingInput = encoder.encode(parts[0] + "." + parts[1]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, base64UrlDecode(parts[2]).buffer as ArrayBuffer, signingInput.buffer as ArrayBuffer);
  if (!valid) throw new Error("invalid_firebase_signature");
  return { uid: claims.sub, email: claims.email };
}
async function encryptionKey(env: Env) {
  return crypto.subtle.importKey("raw", hexBytes(env.TOKEN_ENCRYPTION_KEY).buffer as ArrayBuffer, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptToken(token: string, env: Env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env), encoder.encode(token));
  return { ciphertext: base64UrlEncode(new Uint8Array(encrypted)), iv: base64UrlEncode(iv) };
}
async function decryptToken(record: StoredConnection, env: Env) {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64UrlDecode(record.iv).buffer as ArrayBuffer }, await encryptionKey(env), base64UrlDecode(record.ciphertext).buffer as ArrayBuffer);
  return decoder.decode(plain);
}
async function graph(env: Env, path: string, accessToken: string, init: RequestInit = {}) {
  const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${path.replace(/^\//, "")}`);
  url.searchParams.set("access_token", accessToken);
  const proofKey = await crypto.subtle.importKey("raw", encoder.encode(env.META_APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const proof = new Uint8Array(await crypto.subtle.sign("HMAC", proofKey, encoder.encode(accessToken)));
  url.searchParams.set("appsecret_proof", Array.from(proof, byte => byte.toString(16).padStart(2, "0")).join(""));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers: { "content-type": init.body instanceof URLSearchParams ? "application/x-www-form-urlencoded" : "application/json", ...(init.headers || {}) } });
    const payload = await response.json() as any;
    if (!response.ok || payload.error) throw new Error(payload.error?.message || "meta_api_request_failed");
    return payload;
  } finally { clearTimeout(timer); }
}
async function getConnection(uid: string, env: Env) {
  const record = await env.META_CONNECTIONS.get<StoredConnection>(`connection:${uid}`, "json");
  if (!record) throw new Error("meta_not_connected");
  return { record, accessToken: await decryptToken(record, env) };
}
async function authorizedAdAccount(uid: string, accountId: string, accessToken: string, env: Env) {
  if (!/^act_?[0-9]{5,32}$/.test(accountId)) throw new Error("invalid_ad_account_id");
  const normalized = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const result = await graph(env, "me/adaccounts?fields=id,name,account_status,currency,timezone_name&limit=100", accessToken);
  const account = (result.data || []).find((item: any) => item.id === normalized || item.id === accountId || item.account_id === accountId);
  if (!account) throw new Error("ad_account_not_authorized");
  return { id: account.id, name: account.name || account.id, account_status: account.account_status, currency: account.currency, timezone_name: account.timezone_name };
}
async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    const missing = ["META_APP_ID", "META_APP_SECRET", "TOKEN_ENCRYPTION_KEY", "OAUTH_REDIRECT_URI"].filter(key => !(env as any)[key]);
    return json({ service: "autoviral-meta-api", status: missing.length ? "needs_configuration" : "ready", missing_secrets: missing, firebase_project: env.FIREBASE_PROJECT_ID, meta_graph_version: env.META_GRAPH_VERSION });
  }
  if (request.method === "GET" && url.pathname === "/meta/oauth/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const stateError = url.searchParams.get("error");
    if (stateError) return Response.redirect(`${env.APP_ORIGIN}/?meta_connection=error&reason=authorization_denied`, 302);
    if (!code || !state) return json({ error: "oauth_parameters_missing" }, 400);
    const stateRecord = await env.META_CONNECTIONS.get<{ uid: string }>(`oauth_state:${state}`, "json");
    if (!stateRecord) return json({ error: "oauth_state_invalid_or_expired" }, 400);
    await env.META_CONNECTIONS.delete(`oauth_state:${state}`);
    const tokenUrl = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", env.META_APP_ID);
    tokenUrl.searchParams.set("client_secret", env.META_APP_SECRET);
    tokenUrl.searchParams.set("redirect_uri", env.OAUTH_REDIRECT_URI);
    tokenUrl.searchParams.set("code", code);
    const shortResponse = await fetch(tokenUrl);
    const shortToken = await shortResponse.json() as any;
    if (!shortResponse.ok || !shortToken.access_token) return Response.redirect(`${env.APP_ORIGIN}/?meta_connection=error&reason=token_exchange_failed`, 302);
    const longUrl = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/oauth/access_token`);
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", env.META_APP_ID);
    longUrl.searchParams.set("client_secret", env.META_APP_SECRET);
    longUrl.searchParams.set("fb_exchange_token", shortToken.access_token);
    const longResponse = await fetch(longUrl);
    const longToken = await longResponse.json() as any;
    const accessToken = longResponse.ok && longToken.access_token ? longToken.access_token : shortToken.access_token;
    const profile = await graph(env, "me?fields=id,name", accessToken);
    const encrypted = await encryptToken(accessToken, env);
    const expiresIn = Number(longToken.expires_in || shortToken.expires_in || 0);\n    const record: StoredConnection = { ...encrypted, connectedAt: new Date().toISOString(), expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null, metaUserId: profile.id, metaUserName: profile.name || null, scopes: String(longToken.granted_scopes || shortToken.granted_scopes || "").split(",").filter(Boolean) };
    await env.META_CONNECTIONS.put(`connection:${stateRecord.uid}`, JSON.stringify(record));
    return Response.redirect(`${env.APP_ORIGIN}/?meta_connection=success`, 302);
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const identity = await readFirebaseIdentity(request, env);
  const body = await request.json().catch(() => ({})) as Record<string, any>;
  if (url.pathname === "/meta/oauth/start") {
    const state = randomToken(32);
    await env.META_CONNECTIONS.put(`oauth_state:${state}`, JSON.stringify({ uid: identity.uid }), { expirationTtl: STATE_TTL_SECONDS });
    const authUrl = new URL(`https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth`);
    authUrl.searchParams.set("client_id", env.META_APP_ID);
    authUrl.searchParams.set("redirect_uri", env.OAUTH_REDIRECT_URI);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "ads_read,ads_management,business_management");
    return json({ auth_url: authUrl.toString() });
  }
  const { record, accessToken } = await getConnection(identity.uid, env);
  if (url.pathname === "/meta/accounts") {
    const result = await graph(env, "me/adaccounts?fields=id,name,account_status,currency,timezone_name&limit=100", accessToken);
    return json({ ad_accounts: result.data || [], connected_as: record.metaUserName });
  }
  if (url.pathname === "/meta/campaigns") {
    const account = await authorizedAdAccount(identity.uid, String(body.ad_account_id || ""), accessToken, env);
    const result = await graph(env, `${account.id}/campaigns?fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget&limit=100`, accessToken);
    return json({ account, campaigns: result.data || [] });
  }
  if (url.pathname === "/meta/campaigns/action") {
    const action = body.action;
    if (action !== "pause" && action !== "activate") return json({ error: "unsupported_campaign_action" }, 400);
    const account = await authorizedAdAccount(identity.uid, String(body.ad_account_id || ""), accessToken, env);
    const campaignId = String(body.campaign_id || "");
    if (!/^\d{5,32}$/.test(campaignId)) return json({ error: "invalid_campaign_id" }, 400);
    const ownership = await graph(env, `${campaignId}?fields=id,account_id`, accessToken);
    const ownedAccount = String(ownership.account_id || "");
    if (ownedAccount !== account.id.replace(/^act_/, "")) return json({ error: "campaign_account_mismatch" }, 403);
    const nextStatus = action === "pause" ? "PAUSED" : "ACTIVE";
    await graph(env, campaignId, accessToken, { method: "POST", body: new URLSearchParams({ status: nextStatus }) });
    const verified = await graph(env, `${campaignId}?fields=id,status,effective_status`, accessToken);
    await env.META_CONNECTIONS.put(`audit:${identity.uid}:${Date.now()}`, JSON.stringify({ uid: identity.uid, action, campaignId, adAccountId: account.id, status: verified.status, at: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 365 });
    return json({ verified: verified.status === nextStatus, verified_status: verified.status, campaign_id: campaignId });
  }
  return json({ error: "not_found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(request, env);
    const origin = request.headers.get("Origin");
    if (origin && origin !== env.APP_ORIGIN) return withCors(json({ error: "origin_not_allowed" }, 403), headers);
    if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }), headers);
    try {
      const response = await handle(request, env);
      return withCors(response, headers);
    } catch (error) {
      const message = error instanceof Error ? error.message : "internal_error";
      const status = message.includes("firebase_auth_required") || message.includes("invalid_firebase") ? 401
        : message === "meta_not_connected" ? 409
        : message.includes("not_authorized") || message.includes("mismatch") ? 403 : 400;
      return withCors(json({ error: message }, status), headers);
    }
  },
};
