import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 const auth=req.headers.get("Authorization")||"";
 const token=auth.replace(/^Bearer\s+/i,"");
 if(!token)return reply({error:"Faça login para usar a IA."},401);
 const url=Deno.env.get("SUPABASE_URL")||"";
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default;
 const gemini=Deno.env.get("GEMINI_API_KEY");
 if(!service)return reply({error:"Backend não configurado."},503);
 if(!gemini)return reply({error:"Configure GEMINI_API_KEY nos secrets do Supabase para habilitar a geração com IA."},503);
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:userData,error:userError}=await admin.auth.getUser(token);
 if(userError||!userData.user)return reply({error:"Sessão inválida."},401);
 let input:any;try{input=await req.json();}catch{return reply({error:"JSON inválido."},400);}
 const workspaceId=String(input.workspace_id||"");
 const title=String(input.title||"").trim().slice(0,500);
 const context=String(input.context||"").trim().slice(0,8000);
 const task=String(input.task||"creative");
 const format=String(input.format||"copy").slice(0,80);
 const channel=String(input.channel||"general").slice(0,80);
 if(!workspaceId||!title)return reply({error:"Workspace e tema são obrigatórios."},400);
 const {data:member,error:memberError}=await admin.from("av_workspace_members").select("workspace_id").eq("workspace_id",workspaceId).eq("user_id",userData.user.id).maybeSingle();
 if(memberError||!member)return reply({error:"Você não tem acesso a este workspace."},403);
 const prompt=task==="pain_search"
 ? "Crie um roteiro de pesquisa de mercado em português brasileiro para o tema informado. Separe hipóteses de fatos, não invente estatísticas, fontes, tendências ou dados locais. Liste perguntas para validar, públicos que podem ser entrevistados, termos de busca e fontes públicas que devem ser consultadas. Se não houver fontes verificadas, diga explicitamente que são hipóteses. Tema: "+title+"\nContexto: "+context
 : "Crie um rascunho em português brasileiro para divulgação ética do produto/tema informado. Não invente resultados, depoimentos, garantias, números, certificações ou benefícios que não estejam no contexto. Use CTA claro, linguagem natural, sem spam. Formato: "+format+". Canal: "+channel+". Tema: "+title+"\nContexto real fornecido: "+context+"\nEntregue somente o texto pronto para revisão.";
 const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="+encodeURIComponent(gemini),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.65,maxOutputTokens:1800}})});
 const result=await response.json();
 if(!response.ok)return reply({error:result.error?.message||"Falha na API Gemini."},502);
 const text=result.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("\n").trim();
 if(!text)return reply({error:"A IA não retornou conteúdo."},502);
 return reply({ok:true,text,model:"gemini-2.5-flash"});
});