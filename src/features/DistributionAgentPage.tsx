import './distribution-agent.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Bot, PauseCircle, RefreshCw, Save, ShieldCheck, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Settings = {
  enabled: boolean;
  mode: 'assisted' | 'automatic';
  batch_size: number;
  pause_minutes: 30 | 45 | 60;
  require_approval: boolean;
  paused: boolean;
  pause_reason: string | null;
  next_batch_at: string | null;
};
type LinkRow = { id: string; label: string | null; code: string; campaign_id: string | null };
type EventRow = { tracking_link_id: string; event_type: string; country_code: string | null; created_at: string };
const defaults: Settings = { enabled: false, mode: 'assisted', batch_size: 1, pause_minutes: 30, require_approval: true, paused: false, pause_reason: null, next_batch_at: null };

export function DistributionAgentPage({ workspaceId }: { workspaceId: string | null }) {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [postCounts, setPostCounts] = useState({ scheduled: 0, published: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [metaAccounts, setMetaAccounts] = useState<Array<{id:string;name:string;currency?:string}>>([]);
  const [metaAccountId, setMetaAccountId] = useState('');
  const [metaDatePreset, setMetaDatePreset] = useState('last_7d');
  const [metaLevel, setMetaLevel] = useState('ad');
  const [metaInsights, setMetaInsights] = useState<Array<Record<string, any>>>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState('');
  const [metaLoaded, setMetaLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !workspaceId) { setLoading(false); return; }
    setLoading(true); setError('');
    const [policy, linkResult, eventResult, posts] = await Promise.all([
      supabase.from('av_distribution_settings').select('enabled,mode,batch_size,pause_minutes,require_approval,paused,pause_reason,next_batch_at').eq('workspace_id', workspaceId).maybeSingle(),
      supabase.from('av_tracking_links').select('id,label,code,campaign_id').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(100),
      supabase.from('av_tracking_events').select('tracking_link_id,event_type,country_code,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(5000),
      supabase.from('av_campaign_posts').select('status').eq('workspace_id', workspaceId).limit(2000),
    ]);
    if (policy.error) setError(policy.error.message);
    else if (policy.data) setSettings({ ...defaults, ...policy.data, pause_minutes: ([30,45,60].includes(policy.data.pause_minutes) ? policy.data.pause_minutes : 30) as 30|45|60 });
    if (linkResult.error) setError(linkResult.error.message);
    else setLinks(linkResult.data || []);
    if (eventResult.error) setError(eventResult.error.message);
    else setEvents(eventResult.data || []);
    if (posts.error) setError(posts.error.message);
    else setPostCounts({
      scheduled: (posts.data || []).filter((p: any) => p.status === 'scheduled' || p.status === 'awaiting_admin').length,
      published: (posts.data || []).filter((p: any) => p.status === 'published').length,
      failed: (posts.data || []).filter((p: any) => p.status === 'failed').length,
    });
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => ({
    clicks: events.filter(e => e.event_type === 'click').length,
    leads: events.filter(e => e.event_type === 'lead').length,
    sales: events.filter(e => e.event_type === 'sale').length,
  }), [events]);

  const creativeRows = useMemo(() => links.map(link => {
    const related = events.filter(e => e.tracking_link_id === link.id);
    return { ...link, clicks: related.filter(e => e.event_type === 'click').length, leads: related.filter(e => e.event_type === 'lead').length, sales: related.filter(e => e.event_type === 'sale').length };
  }).sort((a,b) => b.clicks-a.clicks), [links, events]);

  async function loadMetaAccounts() {
    if (!supabase || !workspaceId) return;
    setMetaLoading(true); setMetaError('');
    const { data, error: invokeError } = await supabase.functions.invoke('av-meta-ads', { body: { action: 'list_accounts', workspace_id: workspaceId } });
    if (invokeError || data?.error) setMetaError(data?.message || invokeError?.message || 'Não foi possível consultar as contas Meta.');
    else {
      const accounts = (data?.ad_accounts || []) as Array<{id:string;name:string;currency?:string}>;
      setMetaAccounts(accounts);
      if (!metaAccountId && accounts.length) setMetaAccountId(accounts[0].id);
      if (!accounts.length) setMetaError('Nenhuma conta de anúncios autorizada foi encontrada nesta conexão Meta.');
    }
    setMetaLoading(false);
  }

  async function loadMetaInsights() {
    if (!supabase || !workspaceId || !metaAccountId) return;
    setMetaLoading(true); setMetaError(''); setMetaLoaded(false);
    const { data, error: invokeError } = await supabase.functions.invoke('av-meta-ads', { body: { action: 'get_insights', workspace_id: workspaceId, ad_account_id: metaAccountId, date_preset: metaDatePreset, level: metaLevel } });
    if (invokeError || data?.error) setMetaError(data?.message || invokeError?.message || 'Falha ao buscar Insights da Meta. Verifique ads_read.');
    else { setMetaInsights(data?.insights || []); setMetaLoaded(true); }
    setMetaLoading(false);
  }

  useEffect(() => { if (workspaceId) void loadMetaAccounts(); }, [workspaceId]);
  async function savePolicy() {
    if (!supabase || !workspaceId) return;
    setSaving(true); setMessage(''); setError('');
    const { data: userResult } = await supabase.auth.getUser();
    const payload = { workspace_id: workspaceId, ...settings, stop_on_rate_limit: true, stop_on_permission_error: true, created_by: userResult.user?.id };
    const { error: saveError } = await supabase.from('av_distribution_settings').upsert(payload, { onConflict: 'workspace_id' });
    if (saveError) setError(saveError.message);
    else {
      await supabase.from('av_distribution_events').insert({
        workspace_id: workspaceId, event_type: 'policy_saved',
        details: { pause_minutes: settings.pause_minutes, batch_size: settings.batch_size, mode: settings.mode, enabled: settings.enabled },
        created_by: userResult.user?.id,
      });
      setMessage('Política salva. O temporizador será aplicado pelo worker de Stories quando a migration e a função atualizada estiverem implantadas.');
    }
    setSaving(false);
    await load();
  }

  return <div className="av-page">
    <section className="av-page-heading">
      <div><span className="av-kicker">AUTO VIRAL · GROWTH ENGINE</span><h1>Robô de distribuição</h1><p>Organize a distribuição autorizada, acompanhe os resultados e identifique quais links e campanhas merecem atenção.</p></div>
      <button className="av-button secondary" onClick={() => void load()}><RefreshCw size={15}/> Atualizar métricas</button>
    </section>
    <section className="av-panel" style={{padding:20,marginBottom:18}}>
      <div className="av-panel-title"><div><h2><BarChart3 size={19}/> Meta Performance Intelligence</h2><p>Insights reais da conta de anúncios conectada. Esta visão mede campanhas pagas, não alcance orgânico.</p></div><span className="av-status">META API</span></div>
      <div className="av-agent-grid">
        <label className="av-field">Conta de anúncios<select value={metaAccountId} onChange={e=>setMetaAccountId(e.target.value)}><option value="">Selecione uma conta</option>{metaAccounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.id} {a.currency ? "· "+a.currency : ""}</option>)}</select></label>
        <label className="av-field">Período<select value={metaDatePreset} onChange={e=>setMetaDatePreset(e.target.value)}><option value="today">Hoje</option><option value="yesterday">Ontem</option><option value="last_7d">Últimos 7 dias</option><option value="last_14d">Últimos 14 dias</option><option value="last_30d">Últimos 30 dias</option><option value="this_month">Este mês</option><option value="last_month">Mês passado</option></select></label>
        <label className="av-field">Detalhamento<select value={metaLevel} onChange={e=>setMetaLevel(e.target.value)}><option value="ad">Por anúncio / criativo</option><option value="adset">Por conjunto</option><option value="campaign">Por campanha</option></select></label>
      </div>
      <div style={{display:"flex",gap:10,marginTop:14,alignItems:"center",flexWrap:"wrap"}}><button className="av-button secondary" disabled={metaLoading} onClick={()=>void loadMetaAccounts()}><RefreshCw size={15}/> Atualizar contas</button><button className="av-button primary" disabled={metaLoading||!metaAccountId} onClick={()=>void loadMetaInsights()}>{metaLoading?"Consultando…":"Buscar Insights da Meta"}</button>{metaLoaded&&<span className="av-feedback">Dados recebidos da Marketing API</span>}</div>
      {metaError&&<p className="av-feedback error" role="alert" style={{marginTop:12}}>{metaError}</p>}
      {metaLoaded && <div className="av-table-wrap"><table className="av-table"><thead><tr><th>Anúncio / criativo</th><th>Impressões</th><th>Alcance</th><th>Cliques</th><th>CTR</th><th>Gasto</th><th>CPC</th></tr></thead><tbody>{metaInsights.map((row,i)=><tr key={String(row.ad_id||row.adset_id||row.campaign_id||i)}><td><strong>{row.ad_name||row.adset_name||row.campaign_name||"Sem nome"}</strong><small>{row.campaign_name||row.adset_name||row.ad_id||""}</small></td><td>{Number(row.impressions||0).toLocaleString("pt-BR")}</td><td>{Number(row.reach||0).toLocaleString("pt-BR")}</td><td>{Number(row.inline_link_clicks||row.clicks||0).toLocaleString("pt-BR")}</td><td>{Number(row.ctr||0).toLocaleString("pt-BR",{maximumFractionDigits:2})}%</td><td>{row.spend??"—"}</td><td>{row.cpc??"—"}</td></tr>)}</tbody></table>{metaInsights.length===0&&<p className="av-empty">A Meta não retornou anúncios com dados neste período.</p>}</div>}
      <div className="av-safety-note"><ShieldCheck size={18}/><div><strong>Transparência das métricas</strong><span>Impressões, alcance, cliques, CTR, gasto e CPC vêm dos Insights de anúncios da Meta e exigem a permissão ads_read. Para Insights orgânicos de Instagram/Facebook (Stories, Reels e publicações), será necessária uma integração separada com permissões e endpoints específicos.</span></div></div>
    </section>
    <section className="av-panel" style={{padding:20,marginBottom:18}}>
      <div className="av-panel-title"><div><h2><Bot size={19}/> Agente de distribuição</h2><p>Configuração operacional por workspace</p></div><span className={settings.paused ? 'av-status' : settings.enabled ? 'av-status success' : 'av-status'}>{settings.paused ? 'PAUSADO PARA REVISÃO' : settings.enabled ? 'POLÍTICA HABILITADA' : 'EM PAUSA'}</span></div>
      <div className="av-grid av-grid-4" style={{marginTop:16}}>
        <div className="av-stat"><span>Na fila</span><strong>{postCounts.scheduled}</strong><small>Publicações agendadas</small></div>
        <div className="av-stat"><span>Publicadas</span><strong>{postCounts.published}</strong><small>Confirmadas no banco</small></div>
        <div className="av-stat"><span>Falhas</span><strong>{postCounts.failed}</strong><small>Precisam de revisão</small></div>
        <div className="av-stat"><span>Pausa configurada</span><strong>{settings.pause_minutes} min</strong><small>Entre lotes de Stories</small></div>
      </div>
      <div className="av-agent-grid">
        <label className="av-check"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings(s=>({...s,enabled:e.target.checked}))}/> Habilitar política do agente</label>
        <label className="av-field">Modo de operação<select value={settings.mode} onChange={e=>setSettings(s=>({...s,mode:e.target.value as Settings['mode']}))}><option value="assisted">Assistido — exige aprovação</option><option value="automatic">Automático — somente ações previamente autorizadas</option></select></label>
        <label className="av-field">Tarefas por lote<select value={settings.batch_size} onChange={e=>setSettings(s=>({...s,batch_size:Number(e.target.value)}))}>{[1,2,3,5,10].map(n=><option key={n} value={n}>{n} tarefa(s)</option>)}</select></label>
        <label className="av-field">Pausa operacional entre lotes<select value={settings.pause_minutes} onChange={e=>setSettings(s=>({...s,pause_minutes:Number(e.target.value) as 30|45|60}))}><option value={30}>30 minutos</option><option value={45}>45 minutos</option><option value={60}>1 hora</option></select></label>
        <label className="av-check"><input type="checkbox" checked={settings.require_approval} onChange={e=>setSettings(s=>({...s,require_approval:e.target.checked}))}/> Pedir aprovação antes de publicar</label>
      </div>
      {settings.paused && <div className="av-safety-note"><PauseCircle size={18}/><div><strong>Fila pausada por segurança</strong><span>{settings.pause_reason || 'A Meta retornou um erro que exige revisão.'}</span>{settings.next_batch_at && <span>Próxima janela prevista: {new Date(settings.next_batch_at).toLocaleString('pt-BR')}</span>}<button className="av-button secondary" disabled={saving} onClick={async()=>{if(!supabase||!workspaceId)return;setSaving(true);const {error:resumeError}=await supabase.from('av_distribution_settings').update({paused:false,pause_reason:null,enabled:true,next_batch_at:null}).eq('workspace_id',workspaceId);if(resumeError)setError(resumeError.message);else setMessage('Fila retomada manualmente.');setSaving(false);await load();}}>Revisado — retomar fila</button></div></div>}
      <div className="av-safety-note"><ShieldCheck size={18}/><div><strong>Proteção de operação ativa</strong><span>Respostas HTTP 429, erros de permissão (403), token revogado ou restrições da plataforma devem pausar a fila e exigir revisão. O intervalo é uma regra de agenda, não uma garantia contra bloqueios nem um método para contornar detecção.</span></div></div>
      <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginTop:16}}><button className="av-button primary" disabled={saving || loading || !workspaceId} onClick={()=>void savePolicy()}><Save size={15}/>{saving?'Salvando…':'Salvar configuração'}</button>{message&&<span role="status" className="av-feedback">{message}</span>}{error&&<span role="alert" className="av-feedback error">{error}</span>}</div>
    </section>
    <section className="av-grid av-grid-3">
      <div className="av-panel av-stat-card"><span><Activity size={16}/> Cliques rastreados</span><strong>{totals.clicks.toLocaleString('pt-BR')}</strong><small>Eventos registrados pelos links AutoViral</small></div>
      <div className="av-panel av-stat-card"><span><TrendingUp size={16}/> Leads registrados</span><strong>{totals.leads.toLocaleString('pt-BR')}</strong><small>Eventos de lead disponíveis</small></div>
      <div className="av-panel av-stat-card"><span><BarChart3 size={16}/> Vendas registradas</span><strong>{totals.sales.toLocaleString('pt-BR')}</strong><small>Somente eventos atribuídos ao link</small></div>
    </section>
    <section className="av-panel" style={{padding:20,marginTop:18}}>
      <div className="av-panel-title"><div><h2><BarChart3 size={19}/> Desempenho por criativo/link</h2><p>Comparação baseada em eventos reais de rastreamento; não representa alcance ou impressões da Meta.</p></div></div>
      {loading?<p>Carregando dados…</p>:creativeRows.length===0?<p className="av-empty">Ainda não há links rastreáveis para comparar. Crie links em Campanhas e associe cada criativo a um link próprio.</p>:<div className="av-table-wrap"><table className="av-table"><thead><tr><th>Criativo / link</th><th>Cliques</th><th>Leads</th><th>Vendas</th><th>Leitura inicial</th></tr></thead><tbody>{creativeRows.map(row=><tr key={row.id}><td><strong>{row.label||row.code}</strong><small>{row.code}</small></td><td>{row.clicks}</td><td>{row.leads}</td><td>{row.sales}</td><td>{row.clicks===0?'Sem dados suficientes':row.clicks>=20&&row.leads===0?'Revisar oferta/página e CTA':row.sales>0?'Gerando vendas atribuídas':'Continuar observando'}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="av-safety-note" style={{marginTop:18}}><PauseCircle size={18}/><div><strong>Limite desta entrega</strong><span>O worker existente de Stories aplica tamanho do lote e pausa persistida por workspace. O worker e a migration precisam estar implantados no Supabase; feed, Reels e Facebook ainda não estão habilitados por esta entrega.</span></div></section>
  </div>;
}
