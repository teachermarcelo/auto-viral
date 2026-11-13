import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const APP_URL="https://teachermarcelo.github.io/auto-viral/";
const redirect=(status:string,reason?:string)=>{const u=new URL(APP_URL);u.searchParams.set("meta_connection",status);if(reason)u.searchParams.set("reason",reason.slice(0,160));return Response.redirect(u.toString(),302);};
const hex=(buf:ArrayBuffer)=>[...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function encrypt(value:string,secret:string){
 const material=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret+"|autoviral-meta-token-v1"));
 const key=await crypto.subtle.importKey("raw",material,{name:"AES-GCM"},false,["encrypt"]);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(value));
 const bytes=new Uint8Array(iv.length+cipher.byteLength);bytes.set(iv);bytes.set(new Uint8Array(cipher),iv.length);
 return btoa(String.fromCharCode(...bytes));
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="GET")return new Response("Method not allowed",{status:405});
 const incoming=new URL(req.url);
 if(incoming.searchParams.has("error"))return redirect("error",incoming.searchParams.get("error_description")||incoming.searchParams.get("error")||"Autorização recusada.");
 const code=incoming.searchParams.get("code"),state=incoming.searchParams.get("state");
 if(!code||!state)return redirect("error","Resposta OAuth incompleta.");
 try{
  const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default;
  const appId=Deno.env.get("META_APP_ID"),appSecret=Deno.env.get("META_APP_SECRET");
  if(!supabaseUrl||!service||!appId||!appSecret)return redirect("error","Backend sem META_APP_ID ou META_APP_SECRET configurado.");
  const admin=createClient(supabaseUrl,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const digest=hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(state)));
  const {data:row,error:stateErr}=await admin.from("av_meta_oauth_states").select("*").eq("state_hash",digest).maybeSingle();
  if(stateErr||!row||row.consumed_at||new Date(row.expires_at).getTime()<Date.now())return redirect("error","Estado de segurança expirado ou inválido. Inicie novamente.");
  const {data:consumed,error:consumeErr}=await admin.from("av_meta_oauth_states").update({consumed_at:new Date().toISOString()}).eq("id",row.id).is("consumed_at",null).select("id").maybeSingle();
  if(consumeErr||!consumed)return redirect("error","Não foi possível validar a autorização.");
  const redirectUri=supabaseUrl+"/functions/v1/av-meta-oauth-callback";
  const tokenUrl=new URL("https://graph.facebook.com/v24.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id",appId);tokenUrl.searchParams.set("client_secret",appSecret);tokenUrl.searchParams.set("redirect_uri",redirectUri);tokenUrl.searchParams.set("code",code);
  const shortRes=await fetch(tokenUrl);const short=await shortRes.json();
  if(!shortRes.ok||!short.access_token){console.error("Meta token exchange",short.error?.code,short.error?.type);return redirect("error","Meta recusou a troca do código. Confira a URL de retorno cadastrada.");}
  const longUrl=new URL("https://graph.facebook.com/v24.0/oauth/access_token");
  longUrl.searchParams.set("grant_type","fb_exchange_token");longUrl.searchParams.set("client_id",appId);longUrl.searchParams.set("client_secret",appSecret);longUrl.searchParams.set("fb_exchange_token",short.access_token);
  const longRes=await fetch(longUrl);const long=await longRes.json();
  const userToken=longRes.ok&&long.access_token?long.access_token:short.access_token;
  const expiresIn=long.expires_in||short.expires_in||0;
  const pagesUrl=new URL("https://graph.facebook.com/v24.0/me/accounts");
  pagesUrl.searchParams.set("fields","id,name,access_token,instagram_business_account{id,username}");
  pagesUrl.searchParams.set("limit","100");
  const pagesRes=await fetch(pagesUrl,{headers:{Authorization:"Bearer "+userToken}});
  const pages=await pagesRes.json();
  if(!pagesRes.ok||!Array.isArray(pages.data)||!pages.data.length){console.error("Meta pages lookup",pages.error?.code,pages.error?.type);return redirect("error","Nenhuma Página autorizada. Verifique se o Instagram profissional está vinculado a uma Página do Facebook e se as permissões foram concedidas.");}
  const selected=pages.data.find((p:any)=>p.instagram_business_account?.id)||pages.data[0];
  if(!selected.access_token)return redirect("error","Meta não retornou token de acesso à Página.");
  const adAccountsUrl=new URL("https://graph.facebook.com/v24.0/me/adaccounts");
  adAccountsUrl.searchParams.set("fields","id,name,account_status,currency,timezone_name,business{id,name}");
  adAccountsUrl.searchParams.set("limit","100");
  const adAccountsRes=await fetch(adAccountsUrl,{headers:{Authorization:"Bearer "+userToken}});
  const adAccountsPayload=await adAccountsRes.json();
  const adAccounts=adAccountsRes.ok&&Array.isArray(adAccountsPayload.data)?adAccountsPayload.data:[];
  if(!adAccountsRes.ok)console.error("Meta ad accounts lookup",adAccountsPayload.error?.code,adAccountsPayload.error?.type);
  const meRes=await fetch("https://graph.facebook.com/v24.0/me?fields=id",{headers:{Authorization:"Bearer "+userToken}});
  const me=await meRes.json();
  const userCipher=await encrypt(userToken,appSecret),pageCipher=await encrypt(selected.access_token,appSecret);
  const permissionsUrl=new URL("https://graph.facebook.com/v24.0/me/permissions");
  const permissionsRes=await fetch(permissionsUrl,{headers:{Authorization:"Bearer "+userToken}});
  const permissionsPayload=await permissionsRes.json();
  const scopes=permissionsRes.ok&&Array.isArray(permissionsPayload.data)
   ?permissionsPayload.data.filter((p:any)=>p.status==="granted").map((p:any)=>p.permission)
   :[];
  const {error:saveErr}=await admin.from("av_meta_connections").upsert({
   workspace_id:row.workspace_id,meta_user_id:me.id||null,page_id:selected.id,page_name:selected.name||null,
   instagram_account_id:selected.instagram_business_account?.id||null,instagram_username:selected.instagram_business_account?.username||null,
   user_token_ciphertext:userCipher,page_token_ciphertext:pageCipher,ad_accounts:adAccounts,
   token_expires_at:expiresIn?new Date(Date.now()+expiresIn*1000).toISOString():null,
   scopes,status:"connected",connected_by:row.user_id,connected_at:new Date().toISOString(),updated_at:new Date().toISOString()
  },{onConflict:"workspace_id"});
  if(saveErr){console.error("AutoViral Meta save",saveErr.message);return redirect("error","Autorização recebida, mas não foi possível salvar a conexão no AutoViral.");}
  await admin.from("av_integrations").upsert({workspace_id:row.workspace_id,provider:"meta",account_label:selected.instagram_business_account?.username?("@"+selected.instagram_business_account.username+" · "+selected.name):selected.name,status:"connected",scopes,connected_by:row.user_id,last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"workspace_id,provider,account_label"});
  return redirect("success");
 }catch(e){console.error("av-meta-oauth-callback",e instanceof Error?e.message:String(e));return redirect("error","Falha inesperada ao concluir a conexão Meta.");}
});