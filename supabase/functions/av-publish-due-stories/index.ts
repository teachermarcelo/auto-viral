import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
async function decrypt(value:string,secret:string){
 const raw=Uint8Array.from(atob(value),c=>c.charCodeAt(0)),iv=raw.slice(0,12),cipher=raw.slice(12);
 const material=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret+"|autoviral-meta-token-v1"));
 const key=await crypto.subtle.importKey("raw",material,{name:"AES-GCM"},false,["decrypt"]);
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv},key,cipher));
}
async function graphPost(path:string,params:Record<string,string>,token:string){
 const response=await fetch("https://graph.facebook.com/v24.0/"+path,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({...params,access_token:token})});
 const data=await response.json();if(!response.ok||data.error)throw new Error(data.error?.message||"Meta recusou a publicação.");return data;
}
async function publish(post:any,admin:any,appSecret:string){
 const {data:connection,error}=await admin.from("av_meta_connections").select("instagram_account_id,page_token_ciphertext,status").eq("workspace_id",post.workspace_id).eq("status","connected").maybeSingle();
 if(error||!connection?.instagram_account_id||!connection.page_token_ciphertext)throw new Error("Instagram profissional não conectado neste workspace.");
 if(!post.media_url||!/^https:\/\//i.test(post.media_url))throw new Error("O post não tem mídia HTTPS pública.");
 const token=await decrypt(connection.page_token_ciphertext,appSecret),video=/\.(mp4|mov)(\?|$)/i.test(post.media_url);
 const container=await graphPost(connection.instagram_account_id+"/media",{media_type:"STORIES",...(video?{video_url:post.media_url}:{image_url:post.media_url})},token);
 if(!container.id)throw new Error("Meta não retornou o container da mídia.");
 if(video){
  let ready=false;
  for(let i=0;i<12;i++){
   await new Promise(resolve=>setTimeout(resolve,2500));
   const res=await fetch("https://graph.facebook.com/v24.0/"+container.id+"?fields=status_code&access_token="+encodeURIComponent(token));
   const state=await res.json();
   if(state.status_code==="FINISHED"){ready=true;break;}
   if(state.status_code==="ERROR")throw new Error("Meta não conseguiu processar o vídeo.");
  }
  if(!ready)throw new Error("Vídeo ainda não terminou de processar na Meta.");
 }
 const result=await graphPost(connection.instagram_account_id+"/media_publish",{creation_id:container.id},token);
 return String(result.id||container.id);
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const supplied=req.headers.get("x-autoviral-cron-secret")||"";
 if(!/^[a-f0-9]{64}$/i.test(supplied))return json({error:"Unauthorized"},401);
 const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default,appSecret=Deno.env.get("META_APP_SECRET");
 if(!service||!appSecret)return json({error:"Backend Meta sem configuração"},503);
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(supplied)));
 const hash=[...digest].map(b=>b.toString(16).padStart(2,"0")).join("");
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:secret}=await admin.from("av_meta_scheduler_secrets").select("id").eq("token_hash",hash).eq("active",true).maybeSingle();
 if(!secret)return json({error:"Unauthorized"},401);
 const now=new Date().toISOString();
 const {data:due,error}=await admin.from("av_campaign_posts").select("id,workspace_id,campaign_id,channel,status,copy_snapshot,media_url,destination_url,scheduled_at").eq("channel","instagram_story").eq("status","scheduled").lte("scheduled_at",now).order("scheduled_at",{ascending:true}).limit(5);
 if(error)return json({error:"Falha ao consultar a fila"},500);
 const results=[];
 for(const post of due||[]){
  const {data:claimed}=await admin.from("av_campaign_posts").update({status:"publishing",execution_note:"Reservado pelo agendador AutoViral."}).eq("id",post.id).eq("status","scheduled").select("id").maybeSingle();
  if(!claimed)continue;
  try{
   const mediaId=await publish(post,admin,appSecret);
   const {error:updateError}=await admin.from("av_campaign_posts").update({status:"published",published_at:new Date().toISOString(),execution_note:"Story publicado automaticamente pela API oficial do Instagram. Media ID: "+mediaId}).eq("id",post.id);
   if(updateError)throw updateError;
   results.push({post_id:post.id,status:"published"});
  }catch(e){
   const message=e instanceof Error?e.message:"Falha desconhecida";
   await admin.from("av_campaign_posts").update({status:"failed",execution_note:message.slice(0,500)}).eq("id",post.id);
   results.push({post_id:post.id,status:"failed",error:message.slice(0,200)});
  }
 }
 return json({ok:true,processed:results.length,results});
});