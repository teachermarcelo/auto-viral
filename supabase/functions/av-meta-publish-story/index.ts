import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
const cors = { "Access-Control-Allow-Origin": "https://teachermarcelo.github.io", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
async function decrypt(value: string, secret: string) {
  const raw = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const iv = raw.slice(0, 12), cipher = raw.slice(12);
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret + "|autoviral-meta-token-v1"));
  const key = await crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}
async function graphPost(path: string, params: Record<string, string>, token: string) {
  const body = new URLSearchParams({ ...params, access_token: token });
  const response = await fetch("https://graph.facebook.com/v24.0/" + path, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error?.message || "A Meta recusou a publicação.");
  return data;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Faça login no AutoViral." }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
    const appSecret = Deno.env.get("META_APP_SECRET");
    if (!service || !appSecret) return json({ error: "Backend Meta sem configuração de segurança." }, 503);
    const admin = createClient(supabaseUrl, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !auth.user) return json({ error: "Sessão inválida." }, 401);
    const body = await req.json();
    const postId = String(body?.post_id || "");
    if (!postId) return json({ error: "Informe post_id." }, 400);
    const { data: post, error: postError } = await admin.from("av_campaign_posts")
      .select("id,workspace_id,campaign_id,channel,status,copy_snapshot,media_url,destination_url")
      .eq("id", postId).maybeSingle();
    if (postError || !post) return json({ error: "Publicação não encontrada." }, 404);
    const { data: member } = await admin.from("av_workspace_members").select("role")
      .eq("workspace_id", post.workspace_id).eq("user_id", auth.user.id).maybeSingle();
    if (!member) return json({ error: "Sem acesso a este workspace." }, 403);
    if (post.channel !== "instagram_story") return json({ error: "Este endpoint publica Stories. Defina o canal como instagram_story." }, 400);
    if (!post.media_url || !/^https:\/\//i.test(post.media_url)) return json({ error: "Adicione uma imagem ou vídeo HTTPS público ao post." }, 400);
    if (post.status === "published") return json({ ok: true, already_published: true });
    const { data: connection, error: connectionError } = await admin.from("av_meta_connections")
      .select("instagram_account_id,user_token_ciphertext,page_token_ciphertext,status")
      .eq("workspace_id", post.workspace_id).eq("status", "connected").maybeSingle();
    if (connectionError || !connection?.instagram_account_id || !connection.page_token_ciphertext) {
      return json({ error: "Conecte uma conta Instagram profissional em Integrações antes de publicar." }, 409);
    }
    const pageToken = await decrypt(connection.page_token_ciphertext, appSecret);
    const mediaUrl = post.media_url;
    const isVideo = /\.(mp4|mov)(\?|$)/i.test(mediaUrl);
    const container = await graphPost(connection.instagram_account_id + "/media", {
      media_type: "STORIES",
      ...(isVideo ? { video_url: mediaUrl } : { image_url: mediaUrl }),
    }, pageToken);
    if (!container.id) throw new Error("A Meta não retornou o identificador do conteúdo.");
    let ready = false;
    if (isVideo) {
      for (let i = 0; i < 12; i++) {
        await new Promise(resolve => setTimeout(resolve, 2500));
        const check = await fetch("https://graph.facebook.com/v24.0/" + container.id + "?fields=status_code&access_token=" + encodeURIComponent(pageToken));
        const state = await check.json();
        if (state.status_code === "FINISHED") { ready = true; break; }
        if (state.status_code === "ERROR") throw new Error("A Meta não conseguiu processar o vídeo do Story.");
      }
      if (!ready) throw new Error("O vídeo ainda está sendo processado pela Meta. Tente novamente em instantes.");
    }
    const published = await graphPost(connection.instagram_account_id + "/media_publish", { creation_id: container.id }, pageToken);
    await admin.from("av_campaign_posts").update({
      status: "published", published_at: new Date().toISOString(),
      execution_note: "Publicado pela API oficial do Instagram. Media ID: " + String(published.id || container.id)
    }).eq("id", post.id);
    await admin.from("av_integrations").update({ last_checked_at: new Date().toISOString() })
      .eq("workspace_id", post.workspace_id).in("provider", ["meta", "instagram"]);
    return json({ ok: true, published: true, media_id: published.id || container.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na publicação.";
    console.error("av-meta-publish-story", message);
    return json({ error: message.slice(0, 300) }, 500);
  }
});