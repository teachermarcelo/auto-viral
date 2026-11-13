import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Plus, RefreshCw, Users, Megaphone, Upload, Trash2, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './operational-pages.css';

type ProductOption = { id: string; name: string; image_url?: string | null };
type Campaign = {
  id: string; name: string; product_id: string | null; objective: string; status: string; channel: string;
  copy_text: string | null; destination_url: string | null; image_url: string | null; video_url: string | null;
  posting_interval_seconds: number; pause_after_posts: number; pause_duration_minutes: number; paused_until?: string | null; posts_since_pause?: number;
};
type TrackingLink = { id: string; campaign_id: string | null; code: string; destination_url: string; label: string | null };
type ScheduledPost = { id: string; campaign_id: string; campaign_run_id?: string|null; scheduled_at: string; status: string; copy_snapshot: string; destination_url: string | null; published_url: string | null; channel?: string; media_url?: string|null; community_id?: string|null; tracking_link_id?: string|null; execution_note?: string|null };
type CampaignRun = { id:string; campaign_id:string; name:string; status:string; total_groups:number; total_tasks:number; created_at:string; paused_until:string|null };
type Community = { id: string; name: string; url: string; topic: string; status: string; notes: string | null; platform?: string };
type CommunityOption = { id:string; name:string; url:string; topic:string; status:string; platform:string };

const PROJECT_URL = 'https://nuyzvpkvawixidotuuio.supabase.co';
const CLICK_URL = `${PROJECT_URL}/functions/v1/av-click?c=`;
const LEAD_URL = `${PROJECT_URL}/functions/v1/av-lead-capture?c=`;
const KIWIFY_WEBHOOK_URL = `${PROJECT_URL}/functions/v1/av-kiwify-webhook`;

function validHttpUrl(value: string) {
  try { const parsed = new URL(value); return parsed.protocol === 'https:' || parsed.protocol === 'http:'; }
  catch { return false; }
}
function normalizeCommunityUrl(value: string) {
  const parsed = new URL(value.trim());
  parsed.hash = '';
  parsed.search = '';
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  return parsed.toString().replace(/\/$/, '');
}
function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function CampaignsPage({ workspaceId }: { workspaceId: string | null }) {
  const [products,setProducts]=useState<ProductOption[]>([]);
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [links,setLinks]=useState<TrackingLink[]>([]);
  const [communities,setCommunities]=useState<CommunityOption[]>([]);
  const [clickCounts,setClickCounts]=useState<Record<string,number>>({});
  const [postClickStats,setPostClickStats]=useState<Record<string,{count:number;hosts:string[];lastClick:string|null}>>({});
  const [clickSeries,setClickSeries]=useState<{label:string;count:number}[]>([]);
  const [scheduledPosts,setScheduledPosts]=useState<ScheduledPost[]>([]);\n  const [runs,setRuns]=useState<CampaignRun[]>([]);
  const [leadsByCampaign,setLeadsByCampaign]=useState<Record<string,{count:number;cities:string[]}>>({});
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
  const [scheduleOpen,setScheduleOpen]=useState<string|null>(null),[scheduleCount,setScheduleCount]=useState(1);
  const [scheduleStart,setScheduleStart]=useState(localDateTimeValue(new Date(Date.now()+3600000)));
  const [selectedCommunityIds,setSelectedCommunityIds]=useState<string[]>([]);
  const [editingCampaignId,setEditingCampaignId]=useState<string|null>(null);
  const [imageFile,setImageFile]=useState<File|null>(null);
  const [clock,setClock]=useState(Date.now());
  const [form,setForm]=useState({name:'',product_id:'',objective:'organic_traffic',channel:'facebook_group',copy_text:'',destination_url:'',image_url:'',video_url:'',posting_interval_seconds:400,pause_after_posts:5,pause_duration_minutes:30});

  const load=useCallback(async()=>{
    if(!supabase||!workspaceId){setLoading(false);return;}
    setLoading(true);
    const [pr,cr,lr,postr,runr,leadR,communityR]=await Promise.all([
      supabase.from('av_products').select('id,name,image_url').eq('workspace_id',workspaceId).order('name'),
      supabase.from('av_campaigns').select('id,name,product_id,objective,status,channel,copy_text,destination_url,image_url,video_url,posting_interval_seconds,pause_after_posts,pause_duration_minutes,paused_until,posts_since_pause').eq('workspace_id',workspaceId).order('created_at',{ascending:false}),
      supabase.from('av_tracking_links').select('id,campaign_id,code,destination_url,label').eq('workspace_id',workspaceId).order('created_at',{ascending:false}),
      supabase.from('av_campaign_posts').select('id,campaign_id,campaign_run_id,scheduled_at,status,copy_snapshot,destination_url,published_url,channel,media_url,community_id,tracking_link_id,execution_note').eq('workspace_id',workspaceId).order('scheduled_at',{ascending:true}),\n      supabase.from('av_campaign_runs').select('id,campaign_id,name,status,total_groups,total_tasks,created_at,paused_until').eq('workspace_id',workspaceId).order('created_at',{ascending:false}),
      supabase.from('av_leads').select('campaign_id,city').eq('workspace_id',workspaceId),
      supabase.from('av_communities').select('id,name,url,topic,status,platform').eq('workspace_id',workspaceId).order('name')
    ]);
    if(pr.error)setMessage('Produtos: '+pr.error.message);
    if(cr.error)setMessage('Campanhas: '+cr.error.message);
    if(lr.error)setMessage('Links: '+lr.error.message);
    if(postr.error)setMessage('Fila: '+postr.error.message);
    if(communityR.error)setMessage('Grupos: '+communityR.error.message);
    const now=Date.now();
    const campaignRows=(cr.data??[]) as Campaign[];
    const expired=campaignRows.filter(x=>x.status==='paused'&&x.paused_until&&new Date(x.paused_until).getTime()<=now).map(x=>x.id);
    if(expired.length){
      await supabase.from('av_campaigns').update({status:'active',paused_until:null,posts_since_pause:0}).in('id',expired).eq('workspace_id',workspaceId);
      campaignRows.forEach(x=>{if(expired.includes(x.id)){x.status='active';x.paused_until=null;x.posts_since_pause=0;}});
    }
    setProducts((pr.data??[]) as ProductOption[]);
    setCampaigns(campaignRows);
    setLinks((lr.data??[]) as TrackingLink[]);
    setScheduledPosts((postr.data??[]) as ScheduledPost[]);\n    setRuns((runr.data??[]) as CampaignRun[]);
    setCommunities((communityR.data??[]) as CommunityOption[]);
    const leadStats:Record<string,{count:number;cities:string[]}>={};
    for(const lead of leadR.data??[]){if(!lead.campaign_id)continue;leadStats[lead.campaign_id]??={count:0,cities:[]};leadStats[lead.campaign_id].count++;if(lead.city&&!leadStats[lead.campaign_id].cities.includes(lead.city))leadStats[lead.campaign_id].cities.push(lead.city);}
    setLeadsByCampaign(leadStats);
    const linkIds=(lr.data??[]).map((x:TrackingLink)=>x.id);
    if(linkIds.length){
      const since=new Date(Date.now()-6*86400000).toISOString();
      const events=await supabase.from('av_tracking_events').select('tracking_link_id,created_at,referrer_host,device_type').in('tracking_link_id',linkIds).eq('event_type','click').gte('created_at',since);
      const counts:Record<string,number>={},daily:Record<string,number>={},postStats:Record<string,{count:number;hosts:string[];lastClick:string|null}>={};
      for(const event of events.data??[]){
        counts[event.tracking_link_id]=(counts[event.tracking_link_id]??0)+1;
        const day=new Date(event.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});daily[day]=(daily[day]??0)+1;
        const post=(postr.data??[]).find((p:any)=>p.tracking_link_id===event.tracking_link_id);
        if(post){postStats[post.id]??={count:0,hosts:[],lastClick:null};postStats[post.id].count++;if(event.referrer_host&&!postStats[post.id].hosts.includes(event.referrer_host))postStats[post.id].hosts.push(event.referrer_host);if(!postStats[post.id].lastClick||event.created_at>postStats[post.id].lastClick!)postStats[post.id].lastClick=event.created_at;}
      }
      setClickCounts(counts);setPostClickStats(postStats);
      setClickSeries(Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const label=d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});return{label,count:daily[label]??0};}));
    }else{setClickCounts({});setPostClickStats({});setClickSeries([]);}
    setLoading(false);
  },[workspaceId]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{const id=window.setInterval(()=>{setClock(Date.now());if(campaigns.some(x=>x.status==='paused'&&x.paused_until&&new Date(x.paused_until).getTime()<=Date.now()))void load();},1000);return()=>window.clearInterval(id);},[campaigns,load]);

  function resetForm(){setForm({name:'',product_id:'',objective:'organic_traffic',channel:'facebook_group',copy_text:'',destination_url:'',image_url:'',video_url:'',posting_interval_seconds:400,pause_after_posts:5,pause_duration_minutes:30});setEditingCampaignId(null);setImageFile(null);}
  function editCampaign(c:Campaign){setEditingCampaignId(c.id);setImageFile(null);setForm({name:c.name,product_id:c.product_id||'',objective:c.objective,channel:c.channel,copy_text:c.copy_text||'',destination_url:c.destination_url||'',image_url:c.image_url||'',video_url:c.video_url||'',posting_interval_seconds:c.posting_interval_seconds,pause_after_posts:c.pause_after_posts,pause_duration_minutes:c.pause_duration_minutes});window.scrollTo({top:0,behavior:'smooth'});}
  async function saveCampaign(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!supabase||!workspaceId)return;
    if(form.destination_url&&!validHttpUrl(form.destination_url)){setMessage('O link de destino precisa ser http(s).');return;}
    if(form.image_url&&!validHttpUrl(form.image_url)){setMessage('A URL da imagem não é válida.');return;}
    if(form.video_url&&!validHttpUrl(form.video_url)){setMessage('A URL do vídeo não é válida.');return;}
    if(imageFile&&(!['image/jpeg','image/png','image/webp'].includes(imageFile.type)||imageFile.size>5*1024*1024)){setMessage('Envie JPG, PNG ou WebP de até 5 MB.');return;}
    setSaving(true);setMessage('');
    let imageUrl=form.image_url.trim()||null;
    if(imageFile){
      const ext=imageFile.type==='image/png'?'png':imageFile.type==='image/webp'?'webp':'jpg';
      const objectPath=workspaceId+'/campaigns/'+crypto.randomUUID()+'.'+ext;
      const upload=await supabase.storage.from('av-product-media').upload(objectPath,imageFile,{contentType:imageFile.type,cacheControl:'3600',upsert:false});
      if(upload.error){setSaving(false);setMessage('Falha no upload: '+upload.error.message);return;}
      imageUrl=supabase.storage.from('av-product-media').getPublicUrl(objectPath).data.publicUrl;
    }
    const payload={product_id:form.product_id||null,name:form.name.trim(),objective:form.objective,status:editingCampaignId?(campaigns.find(x=>x.id===editingCampaignId)?.status||'planned'):'planned',channel:form.channel,copy_text:form.copy_text.trim()||null,destination_url:form.destination_url.trim()||null,image_url:imageUrl,video_url:form.video_url.trim()||null,posting_interval_seconds:Number(form.posting_interval_seconds),pause_after_posts:Number(form.pause_after_posts),pause_duration_minutes:Number(form.pause_duration_minutes)};
    const result=editingCampaignId
      ? await supabase.from('av_campaigns').update(payload).eq('id',editingCampaignId).eq('workspace_id',workspaceId).select('id').single()
      : await supabase.from('av_campaigns').insert({...payload,workspace_id:workspaceId}).select('id').single();
    if(result.error){setSaving(false);setMessage('Não foi possível salvar: '+result.error.message);return;}
    const campaignId=result.data.id;
    if(form.destination_url){
      const existing=links.find(x=>x.campaign_id===campaignId);
      if(existing){const upd=await supabase.from('av_tracking_links').update({destination_url:form.destination_url.trim(),label:form.name.trim()}).eq('id',existing.id).eq('workspace_id',workspaceId);if(upd.error)setMessage('Campanha salva, mas link não atualizado: '+upd.error.message);}
      else{const code=crypto.randomUUID().replaceAll('-','').slice(0,16);const ins=await supabase.from('av_tracking_links').insert({workspace_id:workspaceId,campaign_id:campaignId,code,destination_url:form.destination_url.trim(),label:form.name.trim()});if(ins.error)setMessage('Campanha salva, mas link não criado: '+ins.error.message);}
    }
    setSaving(false);setMessage(editingCampaignId?'Campanha atualizada.':'Campanha criada e salva no banco.');resetForm();await load();
  }
  async function removeCampaign(c:Campaign){
    if(!supabase||!workspaceId||!window.confirm('Excluir a campanha "'+c.name+'"? Os lembretes serão removidos; cliques, leads e vendas históricos serão preservados sem vínculo com a campanha.'))return;
    const {error}=await supabase.from('av_campaigns').delete().eq('id',c.id).eq('workspace_id',workspaceId);
    if(error)setMessage('Não foi possível excluir: '+error.message);else{setMessage('Campanha excluída; registros históricos preservados.');if(editingCampaignId===c.id)resetForm();await load();}
  }
  async function setCampaignStatus(c:Campaign,status:string){if(!supabase||!workspaceId)return;const {error}=await supabase.from('av_campaigns').update({status,paused_until:status==='paused'?(c.paused_until||new Date(Date.now()+30*60000).toISOString()):null}).eq('id',c.id).eq('workspace_id',workspaceId);if(error)setMessage(error.message);else await load();}
  async function markAwaitingAdmin(post:ScheduledPost){if(!supabase||!workspaceId)return;const {error}=await supabase.from('av_campaign_posts').update({status:'awaiting_admin',execution_note:'Aguardando autorização do administrador do grupo.'}).eq('id',post.id).eq('workspace_id',workspaceId);if(error)setMessage(error.message);else await load();}
  async function markPostPublished(post:ScheduledPost){
    if(!supabase||!workspaceId)return;
    const url=window.prompt('Cole o link da publicação (opcional):',post.destination_url||'');if(url===null)return;
    if(url.trim()&&!validHttpUrl(url.trim())){setMessage('Informe uma URL válida.');return;}
    const {error}=await supabase.from('av_campaign_posts').update({status:'published',published_at:new Date().toISOString(),published_url:url.trim()||null,execution_note:'Publicado manualmente e confirmado pelo operador.'}).eq('id',post.id).eq('workspace_id',workspaceId);
    if(error){setMessage('Não foi possível registrar: '+error.message);return;}
    const campaign=campaigns.find(x=>x.id===post.campaign_id);
    if(campaign&&campaign.pause_after_posts>0&&campaign.pause_duration_minutes>0){
      const next=(campaign.posts_since_pause||0)+1;
      if(next>=campaign.pause_after_posts){const until=new Date(Date.now()+campaign.pause_duration_minutes*60000).toISOString();await supabase.from('av_campaigns').update({status:'paused',paused_until:until,posts_since_pause:0}).eq('id',campaign.id).eq('workspace_id',workspaceId);setMessage('Publicação registrada. Pausa operacional de '+campaign.pause_duration_minutes+' minutos iniciada; a fila será liberada automaticamente ao terminar.');}
      else await supabase.from('av_campaigns').update({posts_since_pause:next}).eq('id',campaign.id).eq('workspace_id',workspaceId);
    }else setMessage('Publicação registrada.');await load();
  }
  async function cancelPost(post:ScheduledPost){if(!supabase||!workspaceId)return;const {error}=await supabase.from('av_campaign_posts').update({status:'cancelled'}).eq('id',post.id).eq('workspace_id',workspaceId);if(error)setMessage(error.message);else await load();}
  async function generateReminders(campaign:Campaign){
    if(!supabase||!workspaceId||!campaign.copy_text){setMessage('Salve uma copy antes de criar a fila.');return;}
    const targetPlatform=campaign.channel==='whatsapp'?'whatsapp':'facebook';
    const targets=communities.filter(x=>selectedCommunityIds.includes(x.id)&&x.status==='approved'&&x.platform===targetPlatform);
    if(['facebook_group','whatsapp'].includes(campaign.channel)&&!targets.length){setMessage('Selecione pelo menos um grupo aprovado em Grupos e oportunidades.');return;}
    const count=Math.min(100,Math.max(1,Number(scheduleCount)||1)),start=new Date(scheduleStart);
    if(!Number.isFinite(start.getTime())){setMessage('Data e horário inválidos.');return;}
    const pauseEvery=Math.max(0,campaign.pause_after_posts||0),pauseMs=Math.max(0,campaign.pause_duration_minutes||0)*60000,interval=Math.max(0,campaign.posting_interval_seconds||0)*1000;
    const tasks:any[]=[];
    const destinations=targets.length?targets:[null];
    for(const community of destinations){
      let next=start.getTime();
      for(let i=0;i<count;i++){
        let trackingLinkId:string|null=null;
        if(community&&campaign.destination_url){
          const code=crypto.randomUUID().replaceAll('-','').slice(0,16);
          const {data,error}=await supabase.from('av_tracking_links').insert({workspace_id:workspaceId,campaign_id:campaign.id,code,destination_url:campaign.destination_url,label:campaign.name+' — '+community.name}).select('id').single();
          if(error){setMessage('Falha ao criar link exclusivo para '+community.name+': '+error.message);return;}
          trackingLinkId=data.id;
        }
        tasks.push({workspace_id:workspaceId,campaign_id:campaign.id,campaign_run_id:runId,community_id:community?.id||null,tracking_link_id:trackingLinkId,channel:'manual',scheduled_at:new Date(next).toISOString(),status:'scheduled',copy_snapshot:campaign.copy_text,media_url:campaign.image_url||campaign.video_url,destination_url:trackingLinkId?CLICK_URL+(await supabase.from('av_tracking_links').select('code').eq('id',trackingLinkId).single()).data?.code:campaign.destination_url});
        next+=interval;if(pauseEvery>0&&(i+1)%pauseEvery===0&&i+1<count)next+=pauseMs;
      }
    }
    const {error}=await supabase.from('av_campaign_posts').insert(tasks);
    if(error){setMessage('Não foi possível salvar a fila: '+error.message);return;}
    setMessage(tasks.length+' tarefa(s) persistida(s). A publicação em grupos continua manual; o temporizador controla o ritmo da fila, não envia posts automaticamente.');setScheduleOpen(null);setSelectedCommunityIds([]);await load();
  }
  const approvedFor=(channel:string)=>communities.filter(x=>x.status==='approved'&&x.platform===(channel==='whatsapp'?'whatsapp':'facebook'));
  const previewImage=imageFile?URL.createObjectURL(imageFile):form.image_url||products.find(p=>p.id===form.product_id)?.image_url||null;
  const statusText=(s:string)=>s==='scheduled'?'Pendente':s==='awaiting_admin'?'Aguardando autorização do administrador':s==='published'?'Postado':s==='cancelled'?'Cancelado':s==='failed'?'Falhou':s;
  return <div className="av-page">
    <section className="av-page-heading"><div><span className="av-eyebrow"><Megaphone size={14}/> CAMPANHAS OPERACIONAIS</span><h1>Campanhas</h1><p>Crie, edite, remova, envie imagens, organize a fila manual e acompanhe resultados por grupo.</p></div><button className="av-button secondary" onClick={()=>void load()}><RefreshCw size={15}/> Atualizar</button></section>
    {message&&<div className="av-message" role="status">{message}</div>}
    <section className="av-panel">
      <h2><Plus size={18}/>{editingCampaignId?'Editar campanha':'Criar campanha real'}</h2>
      <form className="av-form" onSubmit={saveCampaign}>
        <label>Nome da campanha<input required maxLength={180} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex.: Psicopedagogia — avaliação inicial"/></label>
        <div className="av-form-grid"><label>Produto<select value={form.product_id} onChange={e=>{const p=products.find(x=>x.id===e.target.value);setForm({...form,product_id:e.target.value,image_url:p?.image_url||form.image_url});}}><option value="">Sem produto vinculado</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Canal<select value={form.channel} onChange={e=>setForm({...form,channel:e.target.value})}><option value="facebook_group">Grupo do Facebook (manual)</option><option value="instagram">Instagram (manual)</option><option value="instagram_story">Instagram Stories (API oficial)</option><option value="facebook_page">Página do Facebook</option><option value="whatsapp">WhatsApp (manual/opt-in)</option><option value="other">Outro</option></select></label></div>
        <label>Copy / texto da publicação<textarea required rows={5} value={form.copy_text} onChange={e=>setForm({...form,copy_text:e.target.value})} placeholder="Escreva o texto que será usado na publicação."/></label>
        <label>Link de compra / destino<input type="url" value={form.destination_url} onChange={e=>setForm({...form,destination_url:e.target.value})} placeholder="https://..."/></label>
        <div className="av-upload-box"><label className="file-button"><Upload size={15}/> Enviar imagem da campanha<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setImageFile(e.target.files?.[0]||null)}/></label><span>JPG, PNG ou WebP · até 5 MB</span>{previewImage&&<img src={previewImage} alt="Prévia da imagem da campanha" className="av-campaign-preview"/>}</div>
        <label>URL do vídeo (opcional)<input type="url" value={form.video_url} onChange={e=>setForm({...form,video_url:e.target.value})} placeholder="https://..."/></label>
        <div className="av-form-grid three"><label>Intervalo entre tarefas (segundos)<input type="number" min="0" max="86400" value={form.posting_interval_seconds} onChange={e=>setForm({...form,posting_interval_seconds:Number(e.target.value)})}/></label><label>Pausar após N publicações<input type="number" min="0" max="1000" value={form.pause_after_posts} onChange={e=>setForm({...form,pause_after_posts:Number(e.target.value)})}/></label><label>Duração da pausa (minutos)<input type="number" min="0" max="1440" value={form.pause_duration_minutes} onChange={e=>setForm({...form,pause_duration_minutes:Number(e.target.value)})}/></label></div>
        <p className="av-note">A pausa é um controle operacional de ritmo e não garante evitar restrições de plataforma. Postagens em grupos e WhatsApp são manuais e dependem das regras e permissões de cada comunidade.</p>
        <div className="av-row-actions"><button className="av-button primary" disabled={saving}>{saving?'Salvando…':editingCampaignId?'Salvar alterações':'Salvar campanha'}</button>{editingCampaignId&&<button type="button" className="av-button secondary" onClick={resetForm}>Cancelar edição</button>}</div>
      </form>
    </section>
    <section className="av-panel"><div className="av-panel-title"><h2>Campanhas salvas</h2><span>{campaigns.length} registro(s)</span></div>
      {loading?<p className="av-empty">Consultando Supabase…</p>:!campaigns.length?<p className="av-empty">Nenhuma campanha cadastrada.</p>:<div className="av-list">{campaigns.map(c=>{
        const link=links.find(x=>x.campaign_id===c.id),clicks=link?(clickCounts[link.id]||0):0,approvedCommunities=approvedFor(c.channel),paused=c.status==='paused'&&c.paused_until&&new Date(c.paused_until).getTime()>clock,remaining=paused?Math.max(0,Math.ceil((new Date(c.paused_until!).getTime()-clock)/1000)):0;
        return <article className="av-list-row" key={c.id}><div className="av-list-main"><strong>{c.name}</strong><small>{c.status} · {c.channel} · {c.posting_interval_seconds}s entre tarefas</small>{c.image_url&&<img src={c.image_url} alt="Imagem da campanha" className="av-campaign-thumb"/>}<p>{c.copy_text||'Sem texto cadastrado.'}</p>{paused&&<p className="av-cooldown">Pausa ativa · retoma em {Math.floor(remaining/60)}m {remaining%60}s</p>}{link&&<div className="av-track-row"><code>{CLICK_URL}{link.code}</code><button className="av-icon-button" title="Copiar link rastreável" onClick={()=>void navigator.clipboard.writeText(CLICK_URL+link.code)}><Copy size={15}/></button><span>{clicks} clique(s) registrados no link geral</span><a href={LEAD_URL+link.code} target="_blank" rel="noreferrer">Formulário de lead</a><button className="av-icon-button" title="Copiar formulário de lead" onClick={()=>void navigator.clipboard.writeText(LEAD_URL+link.code)}><Copy size={14}/></button></div>}{leadsByCampaign[c.id]&&<p className="av-lead-summary">{leadsByCampaign[c.id].count} lead(s) que preencheram o formulário com consentimento</p>}</div>
          <div className="av-row-actions"><button className="av-button secondary small" onClick={()=>editCampaign(c)}>Editar</button><button className="av-button secondary small" onClick={()=>void setCampaignStatus(c,c.status==='paused'?'active':'paused')}>{c.status==='paused'?'Retomar':'Pausar'}</button><button className="av-button secondary small" onClick={()=>{setScheduleOpen(scheduleOpen===c.id?null:c.id);setScheduleStart(localDateTimeValue(new Date(Date.now()+3600000)));setSelectedCommunityIds([]);}}>Fila de grupos</button><button className="av-icon-button danger" title="Excluir campanha" onClick={()=>void removeCampaign(c)}><Trash2 size={15}/></button></div>
          {scheduleOpen===c.id&&<div className="av-schedule"><strong>Montar fila por grupo</strong><label>Quantidade de tarefas por grupo<input type="number" min="1" max="100" value={scheduleCount} onChange={e=>setScheduleCount(Number(e.target.value))}/></label><label>Início da fila<input type="datetime-local" value={scheduleStart} onChange={e=>setScheduleStart(e.target.value)}/></label><p className="av-note">{approvedCommunities.length} grupo(s) aprovado(s). Selecione os grupos que permitem divulgação. Cada grupo receberá um link de rastreio exclusivo.</p><div className="av-community-picker">{approvedCommunities.map(g=><label key={g.id}><input type="checkbox" checked={selectedCommunityIds.includes(g.id)} onChange={e=>setSelectedCommunityIds(v=>e.target.checked?[...v,g.id]:v.filter(id=>id!==g.id))}/><span>{g.name} · {g.topic}</span></label>)}{!approvedCommunities.length&&<small>Não há grupos aprovados. Revise os grupos em “Grupos e oportunidades” primeiro.</small>}</div><button className="av-button primary small" onClick={()=>void generateReminders(c)}>Criar fila persistente</button><small>As tarefas e o status permanecem salvos após atualizar a página. Publicação manual.</small></div>}
        </article>;
      })}</div>}
    </section>
    <section className="av-panel"><div className="av-panel-title"><h2>Atividades da fila</h2><span>{scheduledPosts.length} tarefa(s) salvas</span></div><p className="av-note">Esta fila é persistida no Supabase. “Pendente” aguarda sua ação; “Aguardando autorização” significa que você solicitou aprovação ao administrador; “Postado” é uma confirmação manual. Não publicamos automaticamente em grupos privados ou arbitrários.</p>
      {!scheduledPosts.length?<p className="av-empty">Nenhuma atividade na fila.</p>:<div className="av-list">{scheduledPosts.map(post=>{const group=communities.find(g=>g.id===post.community_id),stats=postClickStats[post.id],paused=campaigns.find(c=>c.id===post.campaign_id)?.status==='paused';return <article className="av-list-row" key={post.id}><div className="av-list-main"><strong>{campaigns.find(c=>c.id===post.campaign_id)?.name||'Campanha'}{group?' — '+group.name:''}</strong><small>{new Date(post.scheduled_at).toLocaleString('pt-BR')} · {statusText(post.status)}</small><p>{post.copy_snapshot}</p>{post.media_url&&<img src={post.media_url} alt="Mídia da tarefa" className="av-campaign-thumb"/>}{post.destination_url&&<div className="av-track-row"><code>{post.destination_url}</code><button className="av-icon-button" title="Copiar link exclusivo deste grupo" onClick={()=>void navigator.clipboard.writeText(post.destination_url!)}><Copy size={14}/></button></div>}{post.tracking_link_id&&<small>{stats?.count||0} clique(s) neste grupo · origem: {stats?.hosts.join(', ')||'ainda não identificada'}{stats?.lastClick?' · último clique '+new Date(stats.lastClick).toLocaleString('pt-BR'):''}</small>}{post.execution_note&&<small>{post.execution_note}</small>}{post.published_url&&<a href={post.published_url} target="_blank" rel="noreferrer">Abrir publicação registrada <ExternalLink size={12}/></a>}</div>
        <div className="av-row-actions">{post.status==='scheduled'&&<><button className="av-button secondary small" onClick={()=>void markAwaitingAdmin(post)}>Aguardando autorização</button><button className="av-button primary small" disabled={!!paused} onClick={()=>void markPostPublished(post)}>Registrar postado</button><button className="av-button secondary small" onClick={()=>void cancelPost(post)}>Cancelar</button></>}{post.status==='awaiting_admin'&&<button className="av-button primary small" disabled={!!paused} onClick={()=>void markPostPublished(post)}>Registrar postado</button>}</div>
      </article>;})}</div>}
    </section>
    <section className="av-panel"><div className="av-panel-title"><h2>Cliques reais — últimos 7 dias</h2><span>Eventos de rastreamento</span></div>{clickSeries.length===0?<p className="av-empty">Ainda não há cliques nos links destas campanhas.</p>:<div className="av-click-chart">{clickSeries.map(day=>{const max=Math.max(1,...clickSeries.map(x=>x.count));return <div className="av-click-day" key={day.label}><span>{day.count}</span><i style={{height:Math.max(3,day.count/max*100)+'%'}}/><small>{day.label}</small></div>;})}</div>}<p className="av-note">O sistema mostra horário, dispositivo e domínio de referência quando disponíveis. Não identifica o perfil pessoal do Facebook que clicou: a plataforma não fornece essa identidade por um clique externo. Nome e contato só aparecem se a pessoa preencher voluntariamente o formulário de lead.</p></section>
  </div>;
}

export function CommunitiesPage({ workspaceId }: { workspaceId: string | null }) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', url: '', topic: 'Psicopedagogia', platform: 'facebook', rules_url: '', notes: '' });

  const load = useCallback(async () => {
    if (!supabase || !workspaceId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from('av_communities').select('id,name,url,topic,status,notes,platform').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
    if (error) setMessage(`Erro ao carregar grupos: ${error.message}`);
    setCommunities((data ?? []) as Community[]);
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { void load(); }, [load]);

  async function addCommunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !workspaceId) return;
    if (!validHttpUrl(form.url)) { setMessage('Informe um endereço válido do grupo.'); return; }
    let normalized: string;
    try { normalized = normalizeCommunityUrl(form.url); } catch { setMessage('Não foi possível normalizar o endereço do grupo.'); return; }
    const { error } = await supabase.from('av_communities').insert({
      workspace_id: workspaceId, name: form.name.trim(), url: form.url.trim(), platform: form.platform,
      normalized_url: normalized, topic: form.topic.trim() || 'Geral',
      rules_url: form.rules_url.trim() || null, notes: form.notes.trim() || null,
    });
    if (error?.code === '23505') setMessage('Este grupo já está cadastrado neste workspace. Não foi criado um duplicado.');
    else if (error) setMessage(`Não foi possível salvar o grupo: ${error.message}`);
    else { setMessage('Grupo salvo. Revise as regras antes de qualquer publicação.'); setForm({ name: '', url: '', topic: 'Psicopedagogia', platform:'facebook', rules_url: '', notes: '' }); await load(); }
  }

  async function updateStatus(item: Community, status: string) {
    if (!supabase || !workspaceId) return;
    const { error } = await supabase.from('av_communities').update({ status, last_reviewed_at: new Date().toISOString() }).eq('id', item.id).eq('workspace_id', workspaceId);
    if (error) setMessage(`Falha ao atualizar: ${error.message}`); else await load();
  }
  async function remove(item: Community) {
    if (!supabase || !workspaceId || !window.confirm(`Excluir o grupo "${item.name}"?`)) return;
    const { error } = await supabase.from('av_communities').delete().eq('id', item.id).eq('workspace_id', workspaceId);
    if (error) setMessage(`Falha ao excluir: ${error.message}`); else await load();
  }

  async function importExtensionFile(file?: File) {
    if (!file || !supabase || !workspaceId) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error('O arquivo precisa ser um JSON exportado pela extensão.');
      const rows = parsed.map((item: Record<string, unknown>) => ({
        workspace_id: workspaceId,
        source_type: typeof item.url === 'string' && item.url.includes('facebook.com/groups/') ? 'group_post' : 'public_page',
        source_url: String(item.url ?? ''),
        source_title: String(item.title ?? '').slice(0, 500),
        excerpt: String(item.selected_text ?? item.description ?? '').slice(0, 3000),
        topic: String(item.signal ?? 'Geral').slice(0, 120),
        signal_type: 'other',
        notes: String(item.notes ?? '').slice(0, 2000),
      })).filter((item: { source_url: string }) => validHttpUrl(item.source_url));
      if (!rows.length) throw new Error('Nenhuma captura com URL http/https válida foi encontrada.');
      const { error } = await supabase.from('av_opportunities').insert(rows);
      if (error) throw new Error(error.message);
      setMessage(`${rows.length} captura(s) importada(s) para o Radar. Revise antes de qualquer contato.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao importar arquivo.');
    }
  }

  return <div className="av-page">
    <section className="av-page-heading">
      <div><span className="av-eyebrow"><Users size={14}/> BASE DE COMUNIDADES</span><h1>Grupos e oportunidades</h1><p>Cadastre grupos encontrados por você, evite duplicados e importe capturas manuais da extensão.</p></div>
      <label className="av-button secondary file-button"><Upload size={15}/> Importar JSON da extensão<input type="file" accept=".json,application/json" onChange={e => void importExtensionFile(e.target.files?.[0])}/></label>
    </section>
    {message && <div className="av-message" role="status">{message}</div>}
    <section className="av-panel">
      <h2><Plus size={18}/> Adicionar grupo</h2>
      <form className="av-form" onSubmit={addCommunity}>
        <div className="av-form-grid">
          <label>Plataforma<select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})}><option value="facebook">Facebook</option><option value="whatsapp">WhatsApp</option><option value="telegram">Telegram</option><option value="other">Outra</option></select></label>
          <label>Nome do grupo<input required maxLength={180} value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Ex.: Mães atípicas — Curitiba"/></label>
          <label>Tema<input required value={form.topic} onChange={e => setForm({...form,topic:e.target.value})} placeholder="Autismo, psicopedagogia..."/></label>
        </div>
        <label>URL do grupo<input required type="url" value={form.url} onChange={e => setForm({...form,url:e.target.value})} placeholder="https://www.facebook.com/groups/..."/></label>
        <label>Link das regras (opcional)<input type="url" value={form.rules_url} onChange={e => setForm({...form,rules_url:e.target.value})} placeholder="https://..."/></label>
        <label>Observações<textarea rows={2} value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} placeholder="Regras, público, aprovação de posts, contato com administrador..."/></label>
        <button className="av-button primary">Salvar grupo e verificar duplicidade</button>
      </form>
    </section>
    <section className="av-panel">
      <div className="av-panel-title"><h2>Grupos cadastrados</h2><span>{communities.length} grupo(s)</span></div>
      {loading ? <p className="av-empty">Consultando Supabase…</p> : communities.length === 0 ? <p className="av-empty">Nenhum grupo cadastrado. Adicione um grupo acima.</p> :
        <div className="av-list">{communities.map(item => <article className="av-list-row" key={item.id}>
          <div className="av-list-main"><strong>{item.name}</strong><small>{(item.platform||'facebook').toUpperCase()} · {item.topic} · {item.status}</small><a href={item.url} target="_blank" rel="noreferrer">{item.url} <ExternalLink size={12}/></a>{item.notes && <p>{item.notes}</p>}</div>
          <select aria-label={`Status de ${item.name}`} value={item.status} onChange={e => void updateStatus(item,e.target.value)}><option value="to_review">Revisar regras</option><option value="approved">Aprovado para participação</option><option value="do_not_post">Não publicar</option><option value="archived">Arquivado</option></select>
          <button className="av-icon-button danger" title="Excluir grupo" onClick={() => void remove(item)}><Trash2 size={15}/></button>
        </article>)}</div>}
    </section>
    <section className="av-panel">
      <h2>Oportunidades capturadas</h2>
      <p className="av-note">As capturas da extensão são importadas como oportunidades para revisão. Esta área não coleta membros nem perfis automaticamente, e não envia mensagens.</p>
      <button className="av-button secondary" onClick={() => window.open('https://teachermarcelo.github.io/auto-viral/', '_blank', 'noopener')}>Abrir plataforma</button>
    </section>
  </div>;
}



type AudienceRow = { id:string; name:string; topic:string; description:string|null; source_type:string; status:string; created_at:string };
type AudienceGroup = { topic:string; count:number; approved:number };
export function AudiencesPage({workspaceId}:{workspaceId:string|null}){
 const [rows,setRows]=useState<AudienceRow[]>([]);
 const [topics,setTopics]=useState<AudienceGroup[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');
 const [form,setForm]=useState({name:'',topic:'',description:''});
 const load=useCallback(async()=>{
  if(!supabase||!workspaceId){setRows([]);setTopics([]);setLoading(false);return;}
  setLoading(true);
  const [a,g]=await Promise.all([
   supabase.from('av_audiences').select('id,name,topic,description,source_type,status,created_at').eq('workspace_id',workspaceId).order('created_at',{ascending:false}),
   supabase.from('av_communities').select('topic,status').eq('workspace_id',workspaceId)
  ]);
  if(a.error)setMessage('Erro ao carregar públicos: '+a.error.message);else setRows((a.data??[]) as AudienceRow[]);
  if(g.error)setMessage('Erro ao ler grupos: '+g.error.message);else{
   const counts=new Map<string,{count:number;approved:number}>();(g.data??[]).forEach((x:{topic:string|null;status:string})=>{const t=(x.topic||'Geral').trim();const v=counts.get(t)||{count:0,approved:0};v.count++;if(x.status==='approved')v.approved++;counts.set(t,v);});
   setTopics([...counts.entries()].map(([topic,v])=>({topic,...v})).sort((x,y)=>y.count-x.count));
   if(!form.topic&&counts.size)setForm(v=>({...v,topic:[...counts.entries()].sort((x,y)=>y[1].count-x[1].count)[0][0]}));
  }
  setLoading(false);
 },[workspaceId]);
 useEffect(()=>{void load();},[load]);
 async function create(e:React.FormEvent){e.preventDefault();if(!supabase||!workspaceId)return;setSaving(true);setMessage('');
  const {error}=await supabase.from('av_audiences').insert({workspace_id:workspaceId,name:form.name.trim(),topic:form.topic.trim()||'Geral',description:form.description.trim()||null,source_type:'facebook_groups',status:'draft'});
  setSaving(false);if(error){setMessage(error.code==='23505'?'Esse público já existe neste workspace.':error.message);return;}
  setMessage('Público salvo. Ele já está disponível para planejamento de campanhas.');setForm(v=>({...v,name:'',description:''}));await load();
 }
 async function changeStatus(row:AudienceRow,status:string){if(!supabase||!workspaceId)return;if(status==='ready'){const group=topics.find(t=>t.topic===row.topic);if(!group||group.approved===0){setMessage('Este público ainda não está pronto: aprove pelo menos um grupo deste nicho em Grupos e oportunidades.');return;}}const {error}=await supabase.from('av_audiences').update({status,updated_at:new Date().toISOString()}).eq('id',row.id).eq('workspace_id',workspaceId);if(error)setMessage(error.message);else await load();}
 async function remove(row:AudienceRow){if(!supabase||!workspaceId||!window.confirm('Excluir o público '+row.name+'?'))return;const {error}=await supabase.from('av_audiences').delete().eq('id',row.id).eq('workspace_id',workspaceId);if(error)setMessage(error.message);else{setMessage('Público excluído.');await load();}}
 const groupTotal=topics.reduce((n,t)=>n+t.count,0);
 return <div className="av-page">
  <section className="av-page-heading"><div><span className="av-eyebrow"><Users size={14}/> SEGMENTAÇÃO DE AUDIÊNCIA</span><h1>Públicos</h1><p>Crie segmentos por nicho usando os temas dos grupos públicos mapeados e salve-os para planejar campanhas.</p></div><button className="av-button secondary" onClick={()=>void load()}><RefreshCw size={15}/> Atualizar</button></section>
  {message&&<div className="av-message" role="status">{message}</div>}
  <section className="posts-stats">
   <article className="av-panel"><small>Públicos salvos</small><strong>{rows.length}</strong><span>Segmentos neste workspace</span></article>
   <article className="av-panel"><small>Grupos mapeados</small><strong>{groupTotal}</strong><span>Grupos reais cadastrados no workspace</span></article>
   <article className="av-panel"><small>Nichos identificados</small><strong>{topics.length}</strong><span>Nichos com comunidades mapeadas</span></article>
  </section>
  <section className="av-panel"><h2><Plus size={18}/> Criar público segmentado</h2>
   <form className="av-form" onSubmit={e=>void create(e)}>
    <div className="av-form-grid"><label>Nome do público<input required minLength={2} maxLength={160} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex.: Professores e coordenadores pedagógicos"/></label>
    <label>Nicho / tema<select value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})}><option value="">Selecionar tema</option>{topics.map(t=><option key={t.topic} value={t.topic}>{t.topic} ({t.count} grupos)</option>)}{!topics.length&&<option value="Geral">Geral</option>}</select></label></div>
    <label>Descrição e critérios<textarea rows={3} maxLength={1200} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descreva quem faz parte deste segmento, interesses e finalidade da campanha."/></label>
    <p className="av-note">Estes registros são segmentos, não grupos individuais. “Pronto para campanha” só pode ser marcado quando existir pelo menos um grupo do mesmo nicho aprovado. Os grupos e suas regras continuam precisando de revisão humana; nenhum membro é coletado.</p>
    <button className="av-button primary" disabled={saving}>{saving?'Salvando…':'Salvar público'}</button>
   </form>
  </section>
  <section className="av-panel"><div className="av-panel-title"><h2>Públicos cadastrados</h2><span>{rows.length} segmento(s)</span></div>
   {loading?<p className="av-empty">Carregando públicos…</p>:!rows.length?<p className="av-empty">Nenhum público salvo ainda. Crie o primeiro acima.</p>:
   <div className="av-list">{rows.map(row=><article className="av-list-row" key={row.id}><div className="av-list-main"><strong>{row.name}</strong><small>{row.topic} · {row.source_type==='facebook_groups'?'Grupos públicos do Facebook':'Fonte manual'} · {new Date(row.created_at).toLocaleDateString('pt-BR')}</small><small>{topics.find(t=>t.topic===row.topic)?.approved||0} grupo(s) aprovado(s) de {topics.find(t=>t.topic===row.topic)?.count||0} cadastrado(s)</small>{row.description&&<p>{row.description}</p>}</div><select aria-label={'Status de '+row.name} value={row.status} onChange={e=>void changeStatus(row,e.target.value)}><option value="draft">Rascunho</option><option value="ready">Pronto para campanha (com grupo aprovado)</option><option value="archived">Arquivado</option></select><button className="av-icon-button danger" title="Excluir público" onClick={()=>void remove(row)}><Trash2 size={15}/></button></article>)}</div>}
  </section>
  <section className="av-panel"><h2>Temas encontrados nos grupos</h2>{!topics.length?<p className="av-empty">Nenhum grupo foi sincronizado. Assim que os grupos aparecerem em Grupos e oportunidades, os temas serão listados aqui.</p>:<div className="av-list">{topics.map(t=><article className="av-list-row" key={t.topic}><div className="av-list-main"><strong>{t.topic}</strong><small>{t.count} grupo(s) associado(s)</small></div><button className="av-button secondary small" onClick={()=>setForm(v=>({...v,topic:t.topic,name:v.name||('Público — '+t.topic)}))}>Usar este tema</button></article>)}</div>}</section>
 </div>;
}

export function PostsPage({ workspaceId }: { workspaceId: string | null }) {
  const [rows, setRows] = useState<{id:string;campaign_id:string;scheduled_at:string;status:string;copy_snapshot:string;destination_url:string|null;published_url:string|null;channel:string;media_url:string|null}[]>([]);
  const [publishingId,setPublishingId]=useState<string|null>(null);
  const [campaignNames, setCampaignNames] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!supabase || !workspaceId) { setRows([]); setLoading(false); return; }
    setLoading(true); setError('');
    const [posts,campaigns] = await Promise.all([
      supabase.from('av_campaign_posts').select('id,campaign_id,scheduled_at,status,copy_snapshot,destination_url,published_url,channel,media_url').eq('workspace_id',workspaceId).order('scheduled_at',{ascending:false}).limit(200),
      supabase.from('av_campaigns').select('id,name').eq('workspace_id',workspaceId)
    ]);
    if(posts.error) setError(posts.error.message); else setRows(posts.data ?? []);
    setCampaignNames(Object.fromEntries((campaigns.data ?? []).map((c:{id:string;name:string})=>[c.id,c.name])));
    setLoading(false);
  },[workspaceId]);
  useEffect(()=>{void load();},[load]);
  async function publishStory(row: typeof rows[number]) {
    if (!supabase) return;
    setPublishingId(row.id); setError('');
    const { data, error } = await supabase.functions.invoke('av-meta-publish-story', { body: { post_id: row.id } });
    setPublishingId(null);
    if (error || data?.error) setError(data?.error || error?.message || 'Falha ao publicar Story.');
    else { setError('Story publicado pela API oficial do Instagram.'); await load(); }
  }
  const published=rows.filter(r=>r.status==='published').length;
  const pending=rows.filter(r=>r.status==='scheduled'||r.status==='publishing').length;
  const failed=rows.filter(r=>r.status==='failed').length;
  return <div className="av-page posts-overview">
    <section className="av-page-heading"><div><span className="av-eyebrow"><FileText size={14}/> RESULTADOS E HISTÓRICO</span><h1>Posts</h1><p>Histórico de publicações e lembretes registrados no AutoViral.</p></div><button className="av-button secondary" onClick={()=>void load()}><RefreshCw size={15}/> Atualizar</button></section>
    {error && <div className="av-message">{error}</div>}
    <section className="posts-stats">
      <article className="av-panel"><small>Publicados</small><strong>{published}</strong><span>Registrados como publicados</span></article>
      <article className="av-panel"><small>Pendentes</small><strong>{pending}</strong><span>Lembretes aguardando ação</span></article>
      <article className="av-panel"><small>Falhas</small><strong>{failed}</strong><span>Registros marcados com falha</span></article>
      <article className="av-panel"><small>Total histórico</small><strong>{rows.length}</strong><span>Últimos 200 registros</span></article>
    </section>
    <section className="av-panel"><div className="av-panel-title"><h2>Links dos posts e histórico</h2><span>{rows.length} registro(s)</span></div>
      {loading ? <p className="av-empty">Carregando histórico…</p> : rows.length===0 ? <p className="av-empty">Ainda não há posts registrados. Crie lembretes em Campanhas e registre as publicações realizadas.</p> :
      <div className="av-list">{rows.map(row=><article className="av-list-row" key={row.id}><div className="av-list-main"><strong>{campaignNames[row.campaign_id] || 'Campanha'}</strong><small>{new Date(row.scheduled_at).toLocaleString('pt-BR')} · {row.status}</small><p>{row.copy_snapshot}</p>{(row.published_url || row.destination_url) && <a href={row.published_url || row.destination_url || '#'} target="_blank" rel="noreferrer">{row.published_url ? 'Abrir publicação registrada' : 'Abrir destino' } <ExternalLink size={12}/></a>}{row.channel==='instagram_story' && row.status!=='published' && <button className="av-button primary small" disabled={publishingId===row.id || !row.media_url} onClick={()=>void publishStory(row)}>{publishingId===row.id?'Publicando…':'Publicar Story agora'}</button>}</div><span className={'post-status '+row.status}>{row.status==='published'?'Publicado':row.status==='scheduled'?'Pendente':row.status==='failed'?'Falhou':row.status}</span></article>)}</div>}
    </section>
    <p className="av-note">Stories agendados são processados pelo agendador a cada minuto. A publicação só ocorre se a conta profissional Meta estiver conectada e a mídia HTTPS pública estiver disponível. Impressões, respostas e curtidas só aparecem quando uma API autorizada fornecer esses eventos.</p>
  </div>;
}


type LeadRow = {id:string;name:string;email:string|null;whatsapp:string|null;city:string|null;campaign_id:string|null;status:string;created_at:string};
export function CRMPage({workspaceId}:{workspaceId:string|null}){
 const [rows,setRows]=useState<LeadRow[]>([]),[campaigns,setCampaigns]=useState<Record<string,string>>({}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState(''),[filter,setFilter]=useState('all');
 const load=useCallback(async()=>{if(!supabase||!workspaceId){setRows([]);setLoading(false);return;}setLoading(true);const [l,c]=await Promise.all([supabase.from('av_leads').select('id,name,email,whatsapp,city,campaign_id,status,created_at').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(500),supabase.from('av_campaigns').select('id,name').eq('workspace_id',workspaceId)]);if(l.error)setError(l.error.message);else{setRows((l.data??[]) as LeadRow[]);setError('');}setCampaigns(Object.fromEntries((c.data??[]).map((x:{id:string;name:string})=>[x.id,x.name])));setLoading(false);},[workspaceId]);
 useEffect(()=>{void load();},[load]);
 async function changeStatus(row:LeadRow,status:string){if(!supabase)return;const {error}=await supabase.from('av_leads').update({status}).eq('id',row.id).eq('workspace_id',workspaceId);if(error)setError(error.message);else setRows(old=>old.map(x=>x.id===row.id?{...x,status}:x));}
 const filtered=rows.filter(r=>(filter==='all'||r.status===filter)&&[r.name,r.email,r.whatsapp,r.city].some(v=>(v||'').toLowerCase().includes(query.toLowerCase())));
 const count=(s:string)=>rows.filter(r=>r.status===s).length;
 return <div className="av-page"><section className="av-page-heading"><div><span className="av-eyebrow">RELACIONAMENTO E VENDAS</span><h1>CRM e vendas</h1><p>Gerencie leads capturados com consentimento e acompanhe o andamento comercial.</p></div><button className="av-button secondary" onClick={()=>void load()}><RefreshCw size={15}/> Atualizar</button></section>
 <section className="posts-stats"><article className="av-panel"><small>Leads totais</small><strong>{rows.length}</strong></article><article className="av-panel"><small>Novos</small><strong>{count('new')}</strong></article><article className="av-panel"><small>Em atendimento</small><strong>{count('contacted')+count('qualified')}</strong></article><article className="av-panel"><small>Convertidos</small><strong>{count('converted')}</strong></article></section>
 <section className="av-panel"><div className="av-toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nome, e-mail, WhatsApp ou cidade"/><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos os status</option><option value="new">Novo</option><option value="contacted">Contatado</option><option value="qualified">Qualificado</option><option value="converted">Convertido</option><option value="lost">Perdido</option></select></div>
 {error&&<p className="av-message">{error}</p>}{loading?<p className="av-empty">Carregando leads…</p>:filtered.length===0?<p className="av-empty">Nenhum lead encontrado para este filtro.</p>:<div className="av-list">{filtered.map(r=><article className="av-list-row" key={r.id}><div className="av-list-main"><strong>{r.name}</strong><small>{[r.email,r.whatsapp,r.city].filter(Boolean).join(' · ')||'Sem dados de contato'} · {new Date(r.created_at).toLocaleString('pt-BR')}</small><p>Campanha: {r.campaign_id?campaigns[r.campaign_id]||'Campanha': 'Não atribuída'}</p></div><select aria-label={'Status de '+r.name} value={r.status} onChange={e=>void changeStatus(r,e.target.value)}><option value="new">Novo</option><option value="contacted">Contatado</option><option value="qualified">Qualificado</option><option value="converted">Convertido</option><option value="lost">Perdido</option></select></article>)}</div>}</section>
 <p className="av-note">Os contatos exibidos foram enviados por formulários com consentimento. Respeite a finalidade informada e os pedidos de descadastro.</p></div>;
}

type OpportunityRow={id:string;source_type:string;source_url:string;source_title:string|null;excerpt:string|null;topic:string;signal_type:string;status:string;created_at:string;community_id:string|null};

function scoreOpportunity(row: Pick<OpportunityRow,'source_title'|'excerpt'|'topic'|'signal_type'>) {
 const text=[row.source_title,row.excerpt,row.topic].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
 const buying=['quanto custa','preço','valor','comprar','onde comprar','indicação','recomenda','preciso de','procuro','alguém conhece','material pronto','kit pedagógico','anamnese','avaliação psicopedagógica'];
 const need=['dificuldade','não consigo','como fazer','preciso','ajuda','atividade','aluno','criança','tea','autismo','psicopedagog'];
 const buyingHits=buying.filter(k=>text.includes(k)).length;
 const needHits=need.filter(k=>text.includes(k)).length;
 const signalBoost=row.signal_type==='purchase_intent'?35:row.signal_type==='need'?20:row.signal_type==='question'?12:0;
 const score=Math.min(100,Math.max(0,20+buyingHits*22+needHits*8+signalBoost));
 return {score,level:score>=70?'Alta':score>=45?'Média':'Baixa'};
}

export function OpportunitiesPage({workspaceId}:{workspaceId:string|null}){
 const [rows,setRows]=useState<OpportunityRow[]>([]),[groups,setGroups]=useState<Record<string,string>>({}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[filter,setFilter]=useState('all');
 const [draft,setDraft]=useState({source_url:'',source_title:'',excerpt:'',topic:'Geral',signal_type:'question',source_type:'website'}),[saving,setSaving]=useState(false);
 const load=useCallback(async()=>{if(!supabase||!workspaceId){setRows([]);setLoading(false);return;}setLoading(true);const [o,g]=await Promise.all([supabase.from('av_opportunities').select('id,source_type,source_url,source_title,excerpt,topic,signal_type,status,created_at,community_id').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(300),supabase.from('av_communities').select('id,name').eq('workspace_id',workspaceId)]);if(o.error)setError(o.error.message);else{setRows((o.data??[]) as OpportunityRow[]);setError('');}setGroups(Object.fromEntries((g.data??[]).map((x:{id:string;name:string})=>[x.id,x.name])));setLoading(false);},[workspaceId]);
 useEffect(()=>{void load();},[load]);
 async function changeStatus(row:OpportunityRow,status:string){if(!supabase)return;const {error}=await supabase.from('av_opportunities').update({status}).eq('id',row.id).eq('workspace_id',workspaceId);if(error)setError(error.message);else setRows(old=>old.map(x=>x.id===row.id?{...x,status}:x));}
 const shown=rows.filter(r=>filter==='all'||r.status===filter);
 return <div className="av-page"><section className="av-page-heading"><div><span className="av-eyebrow">PESQUISA E OPORTUNIDADES</span><h1>Oportunidades</h1><p>Revise sinais identificados em fontes públicas e associe-os a campanhas.</p></div><button className="av-button secondary" onClick={()=>void load()}><RefreshCw size={15}/> Atualizar</button></section>
 <section className="posts-stats"><article className="av-panel"><small>Total</small><strong>{rows.length}</strong></article><article className="av-panel"><small>Novas</small><strong>{rows.filter(x=>x.status==='new').length}</strong></article><article className="av-panel"><small>Qualificadas</small><strong>{rows.filter(x=>x.status==='qualified').length}</strong></article><article className="av-panel"><small>Convertidas</small><strong>{rows.filter(x=>x.status==='converted').length}</strong></article></section>
 <section className="av-panel"><h2>Registrar oportunidade</h2><form className="av-form" onSubmit={async e=>{e.preventDefault();if(!supabase||!workspaceId)return;setSaving(true);const {error}=await supabase.from("av_opportunities").insert({workspace_id:workspaceId,source_type:draft.source_type,source_url:draft.source_url.trim(),source_title:draft.source_title.trim()||null,excerpt:draft.excerpt.trim()||null,topic:draft.topic.trim()||"Geral",signal_type:draft.signal_type,status:"new"});setSaving(false);if(error)setError(error.message);else{setDraft({source_url:"",source_title:"",excerpt:"",topic:"Geral",signal_type:"question",source_type:"website"});await load();}}}><div className="av-form-grid"><label>URL da fonte<input required type="url" value={draft.source_url} onChange={e=>setDraft({...draft,source_url:e.target.value})} placeholder="https://..."/></label><label>Tipo de fonte<select value={draft.source_type} onChange={e=>setDraft({...draft,source_type:e.target.value})}><option value="website">Site</option><option value="group_post">Publicação em grupo</option><option value="public_page">Página pública</option><option value="referral">Indicação</option><option value="other">Outro</option></select></label></div><div className="av-form-grid"><label>Título<input value={draft.source_title} onChange={e=>setDraft({...draft,source_title:e.target.value})} placeholder="Título ou assunto"/></label><label>Tema<input value={draft.topic} onChange={e=>setDraft({...draft,topic:e.target.value})}/></label></div><div className="av-form-grid"><label>Tipo de sinal<select value={draft.signal_type} onChange={e=>setDraft({...draft,signal_type:e.target.value})}><option value="question">Pergunta</option><option value="recommendation">Recomendação</option><option value="need">Necessidade</option><option value="purchase_intent">Intenção de compra</option><option value="discussion">Discussão</option><option value="other">Outro</option></select></label><label>Resumo<textarea rows={2} value={draft.excerpt} onChange={e=>setDraft({...draft,excerpt:e.target.value})}/></label></div><button className="av-button primary" disabled={saving}>{saving?"Salvando…":"Registrar oportunidade"}</button></form></section><section className="av-panel"><div className="av-toolbar"><strong>Oportunidades capturadas</strong><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos os status</option><option value="new">Nova</option><option value="reviewed">Revisada</option><option value="qualified">Qualificada</option><option value="converted">Convertida</option><option value="discarded">Descartada</option></select></div>{error&&<p className="av-message">{error}</p>}{loading?<p className="av-empty">Carregando oportunidades…</p>:shown.length===0?<p className="av-empty">Ainda não existem oportunidades registradas. Os grupos mapeados aparecem em Grupos e oportunidades; sinais de publicações devem ser adicionados após revisão.</p>:<div className="av-list">{shown.map(r=><article className="av-list-row" key={r.id}><div className="av-list-main"><strong>{r.source_title||r.topic||'Oportunidade'}</strong><small>{r.signal_type} · {r.source_type} · {new Date(r.created_at).toLocaleString('pt-BR')} · Prioridade {scoreOpportunity(r).level} ({scoreOpportunity(r).score}/100)</small><p>{r.excerpt||'Sem resumo informado'}{r.community_id?' · Grupo: '+(groups[r.community_id]||'Grupo'):''}</p><a href={r.source_url} target="_blank" rel="noreferrer">Abrir fonte <ExternalLink size={12}/></a></div><select aria-label="Status da oportunidade" value={r.status} onChange={e=>void changeStatus(r,e.target.value)}><option value="new">Nova</option><option value="reviewed">Revisada</option><option value="qualified">Qualificada</option><option value="converted">Convertida</option><option value="discarded">Descartada</option></select></article>)}</div>}</section></div>;
}


export function AnalyticsPage({workspaceId}:{workspaceId:string|null}){
 const [events,setEvents]=useState<{id:number;event_type:string;created_at:string;tracking_link_id:string;referrer_host:string|null}[]>([]),[leads,setLeads]=useState<{id:string;campaign_id:string|null;created_at:string}[]>([]),[posts,setPosts]=useState<{id:string;status:string;channel:string;created_at:string}[]>([]),[sales,setSales]=useState<{id:string;order_status:string;amount:number|null;currency:string;paid_at:string|null}[]>([]),[links,setLinks]=useState<Record<string,string>>({}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{if(!supabase||!workspaceId){setLoading(false);return;}setLoading(true);const [e,l,p,k,s]=await Promise.all([supabase.from('av_tracking_events').select('id,event_type,created_at,tracking_link_id,referrer_host').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(1000),supabase.from('av_leads').select('id,campaign_id,created_at').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(1000),supabase.from('av_campaign_posts').select('id,status,channel,created_at').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(500),supabase.from('av_tracking_links').select('id,label,code').eq('workspace_id',workspaceId),supabase.from('av_sales').select('id,order_status,amount,currency,paid_at').eq('workspace_id',workspaceId).order('received_at',{ascending:false}).limit(1000)]);const errors=[e.error,l.error,p.error,k.error,s.error].filter(Boolean);if(errors.length)setError(errors.map(x=>x?.message).join(' · '));else setError('');setEvents((e.data??[]) as typeof events);setLeads((l.data??[]) as typeof leads);setPosts((p.data??[]) as typeof posts);setSales((s.data??[]) as typeof sales);setLinks(Object.fromEntries((k.data??[]).map((x:{id:string;label:string|null;code:string})=>[x.id,x.label||x.code])));setLoading(false);},[workspaceId]);
 useEffect(()=>{void load();},[load]);
 const clicks=events.filter(x=>x.event_type==='click').length,conversions=sales.filter(x=>['paid','approved'].includes(x.order_status)).length,revenue=sales.filter(x=>['paid','approved'].includes(x.order_status)).reduce((sum,x)=>sum+Number(x.amount||0),0);
 const last7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const key=d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});const day=d.toDateString();return {key,count:events.filter(e=>e.event_type==='click'&&new Date(e.created_at).toDateString()===day).length};});
 const max=Math.max(1,...last7.map(x=>x.count));
 return <div className="av-page"><section className="av-page-heading"><div><span className="av-eyebrow">DESEMPENHO E ATRIBUIÇÃO</span><h1>Analytics</h1><p>Métricas reais recebidas dos links rastreáveis, formulários e registros de publicação.</p></div><button className="av-button secondary" onClick={()=>void load()}><RefreshCw size={15}/> Atualizar</button></section>
 {error&&<p className="av-message">{error}</p>}<section className="posts-stats"><article className="av-panel"><small>Cliques registrados</small><strong>{clicks}</strong></article><article className="av-panel"><small>Leads capturados</small><strong>{leads.length}</strong></article><article className="av-panel"><small>Vendas Kiwify confirmadas</small><strong>{conversions}</strong></article><article className="av-panel"><small>Faturamento confirmado</small><strong>{revenue.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></article><article className="av-panel"><small>Posts registrados</small><strong>{posts.length}</strong></article></section>
 <section className="av-panel"><h2>Cliques por dia · últimos 7 dias</h2>{loading?<p className="av-empty">Carregando métricas…</p>:<div className="av-bars">{last7.map(d=><div className="av-bar-column" key={d.key}><strong>{d.count}</strong><div className="av-bar-track"><i style={{height:(d.count/max*100)+'%'}}/></div><small>{d.key}</small></div>)}</div>}</section>
 <section className="av-panel"><h2>Atividade recente</h2>{events.length===0?<p className="av-empty">Ainda não existem cliques registrados. Crie links rastreáveis e compartilhe-os para começar a medir.</p>:<div className="av-list">{events.slice(0,30).map(e=><article className="av-list-row" key={e.id}><div className="av-list-main"><strong>{e.event_type==='click'?'Clique':e.event_type==='lead'?'Lead':'Venda'}</strong><small>{links[e.tracking_link_id]||'Link rastreável'} · {new Date(e.created_at).toLocaleString('pt-BR')}</small><p>{e.referrer_host||'Origem não informada'}</p></div></article>)}</div>}</section>
 <p className="av-note">Os números representam somente eventos recebidos e armazenados pelo AutoViral. Impressões e interações dentro de redes sociais dependem de APIs oficiais e permissões concedidas.</p></div>;
}


export function IntegrationsPage({workspaceId}:{workspaceId:string|null}){
 const [rows,setRows]=useState<{id:string;provider:string;account_label:string|null;status:string;scopes:string[];last_checked_at:string|null}[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[connecting,setConnecting]=useState(false),[kiwifyToken,setKiwifyToken]=useState(''),[savingKiwify,setSavingKiwify]=useState(false),[kiwifyStatus,setKiwifyStatus]=useState('');
 const providers=[{id:'facebook',name:'Facebook',detail:'Páginas e ativos Meta'},{id:'instagram',name:'Instagram',detail:'Contas profissionais elegíveis'},{id:'youtube',name:'YouTube',detail:'Canal e dados do YouTube'},{id:'pinterest',name:'Pinterest',detail:'Pins e analytics'},{id:'tiktok',name:'TikTok',detail:'Conta e conteúdo' }];
 const load=useCallback(async()=>{if(!supabase||!workspaceId){setLoading(false);return;}setLoading(true);const {data,error}=await supabase.from('av_integrations').select('id,provider,account_label,status,scopes,last_checked_at').eq('workspace_id',workspaceId);if(error)setError(error.message);else{setRows((data??[]) as typeof rows);setError('');}setLoading(false);},[workspaceId]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{const params=new URLSearchParams(window.location.search);const result=params.get('meta_connection');if(result){setError(result==='success'?'Meta conectado com sucesso. Atualize para confirmar os ativos autorizados.':`Falha na conexão Meta: ${params.get('reason')||'verifique permissões e configuração do aplicativo.'}`);void load();params.delete('meta_connection');params.delete('reason');const query=params.toString();window.history.replaceState({},'',window.location.pathname+(query?'?'+query:''));}},[load]);
 const connectMeta=async()=>{if(!supabase||!workspaceId){setError('Entre no workspace do AutoViral antes de conectar.');return;}setConnecting(true);setError('');try{const {data,error}=await supabase.functions.invoke('av-meta-oauth-start',{body:{}});if(error)throw error;if(!data?.auth_url)throw new Error(data?.error||'O backend não retornou a URL de autorização.');window.location.assign(data.auth_url);}catch(e){setError(e instanceof Error?e.message:'Não foi possível iniciar a conexão Meta.');setConnecting(false);}};
 const saveKiwifyToken=async()=>{if(!supabase||!workspaceId||kiwifyToken.trim().length<20){setKiwifyStatus('Cole o token completo gerado pela Kiwify.');return;}setSavingKiwify(true);setKiwifyStatus('');const {data,error}=await supabase.rpc('av_set_kiwify_webhook_token',{p_workspace_id:workspaceId,p_token:kiwifyToken.trim()});setSavingKiwify(false);if(error||data?.ok!==true){setKiwifyStatus(error?.message||'Não foi possível salvar o token.');return;}setKiwifyToken('');setKiwifyStatus('Token Kiwify salvo com segurança. O webhook está pronto para validar os eventos.');};
 return <div className="av-page"><section className="av-page-heading"><div><span className="av-eyebrow">CANAIS E AUTORIZAÇÕES</span><h1>Integrações</h1><p>Conecte contas por autorização oficial. Tokens permanecem protegidos no backend.</p></div><button className="av-button secondary" onClick={()=>void load()}><RefreshCw size={15}/> Atualizar</button></section>
 {error&&<p className="av-message">{error}</p>}
 <section className="av-panel" style={{marginBottom:18}}>
  <div className="av-panel-title"><h2>Rastreamento de vendas Kiwify</h2><span>Webhook seguro</span></div>
  <p>1. Copie esta URL e crie um webhook na Kiwify para os dois produtos, com eventos de compra aprovada, reembolso e chargeback.</p>
  <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><code style={{overflowWrap:'anywhere',fontSize:11}}>{KIWIFY_WEBHOOK_URL}</code><button className="av-button secondary" onClick={()=>void navigator.clipboard.writeText(KIWIFY_WEBHOOK_URL)}><Copy size={14}/> Copiar URL</button></div>
  <p style={{marginTop:12}}>2. Copie o token de segurança gerado pela Kiwify e cole abaixo. Ele será guardado no Vault; não será exibido novamente.</p>
  <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><input type="password" value={kiwifyToken} onChange={e=>setKiwifyToken(e.target.value)} autoComplete="off" placeholder="Token de segurança da Kiwify" style={{flex:'1 1 280px',minWidth:220,padding:'10px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)'}}/><button className="av-button primary" disabled={savingKiwify||!workspaceId} onClick={()=>void saveKiwifyToken()}>{savingKiwify?'Salvando…':'Salvar token Kiwify'}</button></div>
  {kiwifyStatus&&<p className="av-message">{kiwifyStatus}</p>}
 </section>
 <section className="integration-grid">{providers.map(p=>{const match=rows.find(r=>r.provider.toLowerCase()===p.id),connected=match?.status==='connected';return <article className="av-panel integration-card" key={p.id}><div className="integration-card-top"><span className={'integration-logo '+p.id}>{p.name.slice(0,2)}</span><span className={'post-status '+(connected?'published':'scheduled')}>{loading?'Consultando':connected?'Conectado':match?.status||'Desconectado'}</span></div><h2>{p.name}</h2><p>{p.detail}</p>{match?.account_label&&<small>{match.account_label}</small>}{match?.last_checked_at&&<small>Verificado: {new Date(match.last_checked_at).toLocaleString('pt-BR')}</small>}{p.id==='facebook'||p.id==='instagram'?<button className="av-button secondary" disabled={connecting} onClick={()=>void connectMeta()}>{connecting?'Abrindo Meta…':connected?'Reconectar Meta':'Conectar com Meta'}</button>:<button className="av-button secondary" disabled>{'Integração ainda não configurada'}</button>}</article>;})}</section>
 <p className="av-note">Facebook e Instagram compartilham a autorização Meta. O botão abre o domínio oficial do Meta; nenhuma senha é solicitada pelo AutoViral.</p></div>;
}
