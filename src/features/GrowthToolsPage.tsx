import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Plus, RefreshCw, Sparkles, MapPin, FileText, Send, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Row = Record<string, any>;
const states=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const modules:Record<string,{title:string;intro:string;table:string;kind:string;label:string;placeholder:string;field:string}> = {
 'Estúdio criativo':{title:'Estúdio de criativos',intro:'Crie e organize copies, roteiros curtos, carrosséis, Pins, Stories e briefings de imagem.',table:'av_creative_assets',kind:'copy',label:'Título do criativo',placeholder:'Ex.: Reel — 3 erros ao organizar a documentação psicopedagógica',field:'content'},
 'Inteligência de mercado':{title:'Pesquisa de mercado',intro:'Registre perguntas, dores, tendências e referências pesquisadas. Não inventa dados: identifique a fonte da pesquisa.',table:'av_research_reports',kind:'pain_search',label:'Tema ou pergunta de pesquisa',placeholder:'Ex.: principais dificuldades de psicopedagogos ao organizar prontuários',field:'source_summary'},
 'Radar de audiência':{title:'Radar de audiência por cidade',intro:'Organize praças, estados, público e canais para pesquisa e divulgação responsável.',table:'av_city_targets',kind:'organic',label:'Cidade',placeholder:'Ex.: Curitiba',field:'notes'},
 'YouTube':{title:'Central YouTube',intro:'Organize ideias, títulos, descrições e roteiros para vídeos. Publicação e métricas dependem da conexão oficial do canal.',table:'av_social_content',kind:'youtube',label:'Título do vídeo',placeholder:'Ex.: Como montar uma anamnese psicopedagógica',field:'caption'},
 'Comentador':{title:'Biblioteca de respostas e comentários',intro:'Prepare respostas úteis e contextualizadas para uso manual em conversas e comentários. Não publica comentários em massa.',table:'av_creative_assets',kind:'copy',label:'Assunto da resposta',placeholder:'Ex.: Dúvida sobre o conteúdo do kit psicopedagógico',field:'content'},
 'Funis e páginas':{title:'Funis e pré-atendimento',intro:'Prepare textos de pré-atendimento e chamadas para o checkout. Os formulários de leads existentes exigem consentimento explícito.',table:'av_creative_assets',kind:'copy',label:'Nome do fluxo',placeholder:'Ex.: Pré-atendimento — Kit Psicopedagógico',field:'content'},
 'Central de tráfego':{title:'Central de tráfego',intro:'Organize peças sociais e destinos. Use os links rastreáveis criados em Campanhas para medir cliques.',table:'av_social_content',kind:'facebook',label:'Nome da publicação',placeholder:'Ex.: Divulgação do kit em página do Facebook',field:'caption'},
 'Automações':{title:'Regras e rotinas',intro:'Registre rotinas, aprovações e procedimentos. Ações externas só executam quando a integração oficial está autorizada.',table:'av_creative_assets',kind:'copy',label:'Nome da rotina',placeholder:'Ex.: Revisar campanhas toda segunda-feira',field:'content'},
 'Importar':{title:'Importação de comunidades',intro:'Importe uma lista CSV de URLs públicas de grupos que você tem autorização para revisar. A importação apenas cadastra para revisão; não entra em grupos nem publica.',table:'av_communities',kind:'csv',label:'Arquivo CSV',placeholder:'Cole uma URL por linha ou envie CSV',field:'notes'},
};
export function GrowthToolsPage({active,workspaceId}:{active:string;workspaceId:string|null}){
 const config=modules[active]||modules['Estúdio criativo'];
 const [rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[stateCode,setStateCode]=useState('PR'),[city,setCity]=useState(''),[platform,setPlatform]=useState('instagram'),[assetType,setAssetType]=useState('copy'),[status,setStatus]=useState('draft'),[generating,setGenerating]=useState(false);
 const load=useCallback(async()=>{
  if(!supabase||!workspaceId){setRows([]);setLoading(false);return;}
  setLoading(true);
  const {data,error}=await supabase.from(config.table).select('*').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(100);
  if(error)setMessage(error.message);else setRows(data||[]);
  setLoading(false);
 },[workspaceId,config.table]);
 useEffect(()=>{void load();},[load]);
 async function generateWithAI(){
  if(!supabase||!workspaceId||!title.trim()){setMessage('Informe o título/tema para orientar a IA.');return;}
  setGenerating(true);setMessage('');
  const {data,error}=await supabase.functions.invoke('av-gemini-tools',{body:{workspace_id:workspaceId,task:isResearch?'pain_search':'creative',title:title.trim(),context:body.trim(),format:assetType,channel:active}});
  setGenerating(false);
  if(error||!data?.text){setMessage(error?.message||data?.error||'IA indisponível. Configure GEMINI_API_KEY no Supabase.');return;}
  setBody(data.text);
  setMessage('Rascunho gerado pela IA. Revise os fatos e ajuste antes de publicar.');
 }
 async function save(){
  if(!supabase||!workspaceId||!title.trim()){setMessage('Informe um título antes de salvar.');return;}
  setSaving(true);setMessage('');
  let payload:Row={workspace_id:workspaceId};
  if(config.table==='av_city_targets')payload={...payload,city:city.trim()||title.trim(),state_code:stateCode,audience:body.trim(),channel:platform,status:'planned',notes:body.trim()||null};
  else if(config.table==='av_social_content')payload={...payload,platform:active==='YouTube'?'youtube':platform,content_type:active==='YouTube'?'video':'post',title:title.trim(),caption:body.trim(),status};
  else if(config.table==='av_research_reports')payload={...payload,query:title.trim(),report_type:'pain_search',source_summary:body.trim(),content:{status:'manual_research_note'}};
  else payload={...payload,asset_type:active==='Comentador'?'copy':active==='Funis e páginas'?'copy':assetType,channel:active,title:title.trim(),content:body.trim(),status};
  const {error}=await supabase.from(config.table).insert(payload);
  setSaving(false);
  if(error){setMessage('Não foi possível salvar: '+error.message);return;}
  setTitle('');setBody('');setCity('');setMessage('Registro salvo no Supabase.');await load();
 }
 async function importCsv(){
  if(!supabase||!workspaceId||!body.trim()){setMessage('Cole URLs de grupos, uma por linha.');return;}
  const urls=body.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
  let added=0,skipped=0;
  for(const url of urls){
   try{const parsed=new URL(url);if(!['facebook.com','www.facebook.com','m.facebook.com'].includes(parsed.hostname)) {skipped++;continue;}
    const normalized=parsed.origin+parsed.pathname.replace(/\/$/,'');
    const {error}=await supabase.from('av_communities').upsert({workspace_id:workspaceId,name:parsed.pathname.split('/').filter(Boolean).pop()||'Grupo Facebook',url,normalized_url:normalized,topic:'Importado',status:'to_review'},{onConflict:'workspace_id,normalized_url',ignoreDuplicates:true});
    if(error)skipped++;else added++;
   }catch{skipped++;}
  }
  setMessage('Importação concluída: '+added+' inserida(s), '+skipped+' ignorada(s). Revise em Grupos e oportunidades.');setBody('');await load();
 }
 const isCity=config.table==='av_city_targets',isSocial=config.table==='av_social_content',isResearch=config.table==='av_research_reports',isImport=active==='Importar';
 return <div className="av-page">
  <section className="av-page-heading"><div><span className="av-kicker">AUTO VIRAL · {active.toUpperCase()}</span><h1>{config.title}</h1><p>{config.intro}</p></div><button className="av-button secondary" onClick={()=>void load()}><RefreshCw size={15}/> Atualizar</button></section>
  <section className="av-panel av-form" style={{padding:20,marginBottom:18}}>
   <h2 style={{marginTop:0}}>{isImport?'Importar URLs':isCity?'Adicionar praça':isResearch?'Registrar pesquisa':isSocial?'Adicionar conteúdo':'Novo registro'}</h2>
   <label className="av-field">{config.label}
    {isImport?<textarea rows={5} value={body} onChange={e=>setBody(e.target.value)} placeholder="https://www.facebook.com/groups/..." />:<input value={isCity?city:title} onChange={e=>isCity?setCity(e.target.value):setTitle(e.target.value)} placeholder={config.placeholder}/>}
   </label>
   {isCity&&<div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:10}}><label className="av-field">Estado<select value={stateCode} onChange={e=>setStateCode(e.target.value)}>{states.map(s=><option key={s}>{s}</option>)}</select></label><label className="av-field">Canal<select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="organic">Orgânico</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="youtube">YouTube</option></select></label></div>}
   {isSocial&&<div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:10}}><label className="av-field">Canal<select value={platform} onChange={e=>setPlatform(e.target.value)}>{['instagram','facebook','youtube','pinterest','tiktok','whatsapp'].map(p=><option key={p}>{p}</option>)}</select></label><label className="av-field">Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="draft">Rascunho</option><option value="approved">Aprovado</option><option value="scheduled">Agendado</option></select></label></div>}
   {!isImport&&<label className="av-field" style={{marginTop:10}}>{isResearch?'Resumo e fontes consultadas':'Conteúdo'}<textarea rows={5} value={body} onChange={e=>setBody(e.target.value)} placeholder="Escreva o conteúdo, roteiro, observações ou referências. Para usar IA, será necessário conectar uma chave Gemini." /></label>}
   {!isCity&&!isResearch&&!isSocial&&!isImport&&<label className="av-field" style={{marginTop:10}}>Formato<select value={assetType} onChange={e=>setAssetType(e.target.value)}>{['copy','short_video_script','carousel','pin','story','image_brief','email'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>}
   <div style={{display:'flex',gap:10,alignItems:'center',marginTop:14,flexWrap:'wrap'}}>{!isImport&&!isCity&&!isSocial&&<button className="av-button secondary" disabled={generating} onClick={()=>void generateWithAI()}><Sparkles size={14}/>{generating?'Gerando…':'Gerar com Gemini'}</button>}<button className="av-button primary" disabled={saving} onClick={()=>isImport?void importCsv():void save()}>{saving?'Salvando…':isImport?'Importar para revisão':'Salvar no workspace'}</button>{message&&<span role="status" className="av-feedback">{message}</span>}</div>
  </section>
  <section className="av-panel" style={{padding:20}}><div className="av-panel-title"><h2>Registros salvos</h2><span>{rows.length} itens</span></div>
   {loading?<p>Carregando…</p>:rows.length===0?<p>Nenhum registro salvo neste módulo ainda.</p>:<div style={{display:'grid',gap:10}}>{rows.map(row=><article key={row.id} style={{padding:14,border:'1px solid var(--border)',borderRadius:12}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><strong>{row.title||row.name||row.city||row.query||row.url||'Registro'}</strong><span className="av-status">{row.status||row.report_type||row.platform||'Salvo'}</span></div>
    <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',marginBottom:8}}>{row.content||row.caption||row.source_summary||row.notes||row.audience||row.url||''}</p>
    {row.url&&<a href={row.url} target="_blank" rel="noreferrer">Abrir origem <ExternalLink size={12}/></a>}
    {(row.content||row.caption||row.source_summary)&&<button className="av-button secondary" onClick={()=>void navigator.clipboard.writeText(row.content||row.caption||row.source_summary)}><Copy size={13}/> Copiar conteúdo</button>}
   </article>)}</div>}
  </section>
 </div>;
}