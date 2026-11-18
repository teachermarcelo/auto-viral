import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "https://teachermarcelo.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers:cors});
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("");
Deno.serve(async (req: Request) => {
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return json({error:"Method not allowed"},405);
 try {
  const auth=req.headers.get("Authorization")||"";
  const jwt=auth.replace(/^Bearer\s+/i,"");
  if(!jwt || jwt===auth) return json({error:"Faça login no AutoViral novamente."},401);
  const url=Deno.env.get("SUPABASE_URL")!;
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default;
  const appId=Deno.env.get("META_APP_ID");
  if(!url||!service||!appId) return json({error:"Backend Meta sem configuração. Verifique os secrets SUPABASE e META_APP_ID."},503);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userErr}=await admin.auth.getUser(jwt);
  if(userErr||!user) return json({error:"Sessão inválida."},401);
  const {data:members,error:memberErr}=await admin.from("av_workspace_members").select("workspace_id,role,created_at").eq("user_id",user.id).order("created_at",{ascending:true}).limit(10);
  if(memberErr||!members?.length) return json({error:"Nenhum workspace AutoViral foi encontrado para esta conta."},403);
  const preferred=members.find((m:any)=>m.role==="owner"||m.role==="admin")||members[0];
  const state=crypto.randomUUID()+crypto.randomUUID().replaceAll("-","");
  const digest=hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(state)));
  const {error:insertErr}=await admin.from("av_meta_oauth_states").insert({state_hash:digest,workspace_id:preferred.workspace_id,user_id:user.id,expires_at:new Date(Date.now()+10*60*1000).toISOString()});
  if(insertErr) return json({error:"Não foi possível iniciar a autorização Meta."},500);
  const redirectUri=url+"/functions/v1/av-meta-oauth-callback";
  const scopes=["ads_read","ads_management","business_management","pages_show_list","pages_read_engagement","pages_manage_posts","instagram_basic","instagram_content_publish"].join(",");
  const authUrl=new URL("https://www.facebook.com/v24.0/dialog/oauth");
  authUrl.searchParams.set("client_id",appId);
  authUrl.searchParams.set("redirect_uri",redirectUri);
  authUrl.searchParams.set("state",state);
  authUrl.searchParams.set("response_type","code");
  authUrl.searchParams.set("scope",scopes);
  authUrl.searchParams.set("auth_type","rerequest");
  return json({auth_url:authUrl.toString(),redirect_uri:redirectUri});
 } catch(e) {
  console.error("av-meta-oauth-start",e instanceof Error?e.message:String(e));
  return json({error:"Falha ao iniciar conexão Meta."},500);
 }
});