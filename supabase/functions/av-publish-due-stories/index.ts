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
 const data=await response.json();
 if(!response.ok||data.error){
  const error=new Error(data.error?.message||"Meta recusou a publicação.") as Error & {status?:number;metaCode?:number};
  error.status=response.status;error.metaCode=Number(data.error?.code||0);throw error;
 }
 return data;
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
 const now=new Date(),nowIso=now.toISOString();
 const {data:due,error}=await admin.from("av_campaign_posts").select("id,workspace_id,campaign_id,channel,status,copy_snapshot,media_url,destination_url,scheduled_at").eq("channel","instagram_story").eq("status","scheduled").lte("scheduled_at",nowIso).order("scheduled_at",{ascending:true}).limit(50);
 if(error)return json({error:"Falha ao consultar a fila"},500);
 if(!due?.length)return json({ok:true,processed:0,reason:"Fila vazia"});
 // Work one workspace per invocation so each workspace has an independent policy and cooldown.
 const workspaceId=due[0].workspace_id;
 const {data:policy}=await admin.from("av_distribution_settings").select("enabled,paused,pause_reason,batch_size,pause_minutes,next_batch_at").eq("workspace_id",workspaceId).maybeSingle();
 if(policy && !policy.enabled)return json({ok:true,processed:0,reason:"Agente desabilitado",workspace_id:workspaceId});
 if(policy?.paused)return json({ok:true,processed:0,reason:"Fila pausada para revisão",pause_reason:policy.pause_reason,workspace_id:workspaceId});
 if(policy?.next_batch_at && new Date(policy.next_batch_at)>now)return json({ok:true,processed:0,reason:"Pausa operacional em andamento",next_batch_at:policy.next_batch_at,workspace_id:workspaceId});
 const batch=(due||[]).filter(p=>p.workspace_id===workspaceId).slice(0,Math.max(1,Math.min(10,policy?.batch_size||5)));
 const results=[];
 await admin.from("av_distribution_events").insert({workspace_id:workspaceId,event_type:"batch_started",channel:"instagram_story",details:{batch_size:batch.length,pause_minutes:policy?.pause_minutes||0}});
 for(const post of batch){
  const {data:claimed}=await admin.from("av_campaign_posts").update({status:"publishing",execution_note:"Reservado pelo agendador oficial AutoViral."}).eq("id",post.id).eq("status","scheduled").select("id").maybeSingle();
  if(!claimed)continue;
  try{
   const mediaId=await publish(post,admin,appSecret);
   const {error:updateError}=await admin.from("av_campaign_posts").update({status:"published",published_at:new Date().toISOString(),execution_note:"Story publicado pela API oficial do Instagram. Media ID: "+mediaId}).eq("id",post.id);
   if(updateError)throw updateError;
   results.push({post_id:post.id,status:"published"});
   await admin.from("av_distribution_events").insert({workspace_id:workspaceId,event_type:"publish_succeeded",channel:"instagram_story",campaign_id:post.campaign_id,external_reference:mediaId,details:{post_id:post.id}});
  }catch(e){
   const message=e instanceof Error?e.message:"Falha desconhecida";
   const status=(e as any)?.status||0,code=(e as any)?.metaCode||0;
   const rateLimited=status===429||/rate.?limit|too many calls|request limit/i.test(message)||[4,17,32,613].includes(code);
   const permissionError=status===403||[10,200,190].includes(code)||/permission|access token|oauth|not authorized/i.test(message);
   await admin.from("av_campaign_posts").update({status:"failed",execution_note:message.slice(0,500)}).eq("id",post.id);
   results.push({post_id:post.id,status:"failed",error:message.slice(0,200)});
   await admin.from("av_distribution_events").insert({workspace_id:workspaceId,event_type:rateLimited?"rate_limited":permissionError?"permission_error":"publish_failed",channel:"instagram_story",campaign_id:post.campaign_id,details:{post_id:post.id,http_status:status,meta_code:code,message:message.slice(0,300)}});
   if(rateLimited||permissionError){
    const reason=rateLimited?"Meta retornou limite de requisições (HTTP 429/código equivalente). Revisão manual necessária.":"Erro de permissão ou autenticação Meta. Verifique permissões e token antes de retomar.";
    await admin.from("av_distribution_settings").update({paused:true,pause_reason:reason,enabled:false}).eq("workspace_id",workspaceId);
    await admin.from("av_distribution_events").insert({workspace_id:workspaceId,event_type:"paused",channel:"instagram_story",details:{reason,post_id:post.id}});
    break;
   }
  }
 }
 const processed=results.length;
 if(processed>0){
  const pauseMinutes=policy?.pause_minutes||0;
  const nextBatchAt=pauseMinutes>0?new Date(Date.now()+pauseMinutes*60_000).toISOString():null;
  if(policy)await admin.from("av_distribution_settings").update({last_batch_at:new Date().toISOString(),next_batch_at:nextBatchAt}).eq("workspace_id",workspaceId);
  await admin.from("av_distribution_events").insert({workspace_id:workspaceId,event_type:"batch_completed",channel:"instagram_story",details:{processed,published:results.filter(r=>r.status==="published").length,failed:results.filter(r=>r.status==="failed").length,next_batch_at:nextBatchAt}});
  if(nextBatchAt)await admin.from("av_distribution_events").insert({workspace_id:workspaceId,event_type:"cooldown_started",channel:"instagram_story",details:{next_batch_at:nextBatchAt,pause_minutes:pauseMinutes}});
 }
 return json({ok:true,workspace_id:workspaceId,processed,results,next_batch_at:policy&&processed>0?new Date(Date.now()+(policy.pause_minutes||0)*60_000).toISOString():null});
});
