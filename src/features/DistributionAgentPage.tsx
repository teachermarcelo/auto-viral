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
};
type LinkRow = { id: string; label: string | null; code: string; campaign_id: string | null };
type EventRow = { tracking_link_id: string; event_type: string; country_code: string | null; created_at: string };
const defaults: Settings = { enabled: false, mode: 'assisted', batch_size: 1, pause_minutes: 30, require_approval: true };

export function DistributionAgentPage({ workspaceId }: { workspaceId: string | null }) {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [postCounts, setPostCounts] = useState({ scheduled: 0, published: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !workspaceId) { setLoading(false); return; }
    setLoading(true); setError('');
    const [policy, linkResult, eventResult, posts] = await Promise.all([
      supabase.from('av_distribution_settings').select('enabled,mode,batch_size,pause_minutes,require_approval').eq('workspace_id', workspaceId).maybeSingle(),
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
      setMessage('Política de distribuição salva. A execução automática só ocorrerá quando o worker oficial estiver implantado e a conexão do canal estiver validada.');
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
      <div className="av-panel-title"><div><h2><Bot size={19}/> Agente de distribuição</h2><p>Configuração operacional por workspace</p></div><span className={settings.enabled ? 'av-status success' : 'av-status'}>{settings.enabled ? 'POLÍTICA HABILITADA' : 'EM PAUSA'}</span></div>
      <div className="av-grid av-grid-4" style={{marginTop:16}}>
        <div className="av-stat"><span>Na fila</span><strong>{postCounts.scheduled}</strong><small>Publicações agendadas</small></div>
        <div className="av-stat"><span>Publicadas</span><strong>{postCounts.published}</strong><small>Confirmadas no banco</small></div>
        <div className="av-stat"><span>Falhas</span><strong>{postCounts.failed}</strong><small>Precisam de revisão</small></div>
        <div className="av-stat"><span>Pausa configurada</span><strong>{settings.pause_minutes} min</strong><small>Entre lotes de tarefas</small></div>
      </div>
      <div className="av-agent-grid">
        <label className="av-check"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings(s=>({...s,enabled:e.target.checked}))}/> Habilitar política do agente</label>
        <label className="av-field">Modo de operação<select value={settings.mode} onChange={e=>setSettings(s=>({...s,mode:e.target.value as Settings['mode']}))}><option value="assisted">Assistido — exige aprovação</option><option value="automatic">Automático — somente ações previamente autorizadas</option></select></label>
        <label className="av-field">Tarefas por lote<select value={settings.batch_size} onChange={e=>setSettings(s=>({...s,batch_size:Number(e.target.value)}))}>{[1,2,3,5,10].map(n=><option key={n} value={n}>{n} tarefa(s)</option>)}</select></label>
        <label className="av-field">Pausa operacional entre lotes<select value={settings.pause_minutes} onChange={e=>setSettings(s=>({...s,pause_minutes:Number(e.target.value) as 30|45|60}))}><option value={30}>30 minutos</option><option value={45}>45 minutos</option><option value={60}>1 hora</option></select></label>
        <label className="av-check"><input type="checkbox" checked={settings.require_approval} onChange={e=>setSettings(s=>({...s,require_approval:e.target.checked}))}/> Pedir aprovação antes de publicar</label>
      </div>
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
    <section className="av-safety-note" style={{marginTop:18}}><PauseCircle size={18}/><div><strong>Limite desta entrega</strong><span>Esta tela salva a política e consolida métricas que já existem. Ela não publica por conta própria: o worker de execução por canal, a coleta de Insights da Meta e a atribuição de vendas precisam ser conectados e validados separadamente antes de ativar o agente em produção.</span></div></section>
  </div>;
}
