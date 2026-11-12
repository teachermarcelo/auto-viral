import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Plus, RefreshCw, Users, Megaphone, CalendarClock, Upload, Trash2, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './operational-pages.css';

type ProductOption = { id: string; name: string };
type Campaign = {
  id: string; name: string; product_id: string | null; objective: string; status: string; channel: string;
  copy_text: string | null; destination_url: string | null; image_url: string | null; video_url: string | null;
  posting_interval_seconds: number; pause_after_posts: number; pause_duration_minutes: number;
};
type TrackingLink = { id: string; campaign_id: string | null; code: string; destination_url: string; label: string | null };
type ScheduledPost = { id: string; campaign_id: string; scheduled_at: string; status: string; copy_snapshot: string; destination_url: string | null; published_url: string | null };
type Community = { id: string; name: string; url: string; topic: string; status: string; notes: string | null };

const PROJECT_URL = 'https://nuyzvpkvawixidotuuio.supabase.co';
const CLICK_URL = `${PROJECT_URL}/functions/v1/av-click?c=`;
const LEAD_URL = `${PROJECT_URL}/functions/v1/av-lead-capture?c=`;

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
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});
  const [clickSeries, setClickSeries] = useState<{ label: string; count: number }[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [leadsByCampaign, setLeadsByCampaign] = useState<Record<string, { count: number; cities: string[] }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState<string | null>(null);
  const [scheduleCount, setScheduleCount] = useState(1);
  const [scheduleStart, setScheduleStart] = useState(localDateTimeValue(new Date(Date.now() + 3600000)));

  const [form, setForm] = useState({
    name: '', product_id: '', objective: 'organic_traffic', channel: 'facebook_group',
    copy_text: '', destination_url: '', image_url: '', video_url: '',
    posting_interval_seconds: 360, pause_after_posts: 0, pause_duration_minutes: 0,
  });

  const load = useCallback(async () => {
    if (!supabase || !workspaceId) { setLoading(false); return; }
    setLoading(true);
    const [productResult, campaignResult, linkResult, postResult, leadResult] = await Promise.all([
      supabase.from('av_products').select('id,name').eq('workspace_id', workspaceId).order('name'),
      supabase.from('av_campaigns').select('id,name,product_id,objective,status,channel,copy_text,destination_url,image_url,video_url,posting_interval_seconds,pause_after_posts,pause_duration_minutes').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('av_tracking_links').select('id,campaign_id,code,destination_url,label').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('av_campaign_posts').select('id,campaign_id,scheduled_at,status,copy_snapshot,destination_url,published_url').eq('workspace_id', workspaceId).order('scheduled_at', { ascending: true }),
      supabase.from('av_leads').select('campaign_id,city').eq('workspace_id', workspaceId),
    ]);
    if (productResult.error) setMessage(`Produtos: ${productResult.error.message}`);
    if (campaignResult.error) setMessage(`Campanhas: ${campaignResult.error.message}`);
    if (linkResult.error) setMessage(`Links: ${linkResult.error.message}`);
    if (postResult.error) setMessage(`Calendário: ${postResult.error.message}`);
    setScheduledPosts((postResult.data ?? []) as ScheduledPost[]);
    if (leadResult.error) setMessage(`Leads: ${leadResult.error.message}`);
    const leadStats: Record<string, { count: number; cities: string[] }> = {};
    for (const lead of leadResult.data ?? []) {
      if (!lead.campaign_id) continue;
      leadStats[lead.campaign_id] ??= { count: 0, cities: [] };
      leadStats[lead.campaign_id].count += 1;
      if (lead.city && !leadStats[lead.campaign_id].cities.includes(lead.city)) leadStats[lead.campaign_id].cities.push(lead.city);
    }
    setLeadsByCampaign(leadStats);
    setProducts((productResult.data ?? []) as ProductOption[]);
    setCampaigns((campaignResult.data ?? []) as Campaign[]);
    setLinks((linkResult.data ?? []) as TrackingLink[]);
    const ids = (linkResult.data ?? []).map((item: TrackingLink) => item.id);
    if (ids.length) {
      const since = new Date(Date.now() - 6 * 86400000).toISOString();
      const events = await supabase.from('av_tracking_events').select('tracking_link_id,created_at').in('tracking_link_id', ids).eq('event_type', 'click').gte('created_at', since);
      if (!events.error) {
        const counts: Record<string, number> = {};
        const daily: Record<string, number> = {};
        for (const event of events.data ?? []) {
          counts[event.tracking_link_id] = (counts[event.tracking_link_id] ?? 0) + 1;
          const key = new Date(event.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          daily[key] = (daily[key] ?? 0) + 1;
        }
        setClickCounts(counts);
        setClickSeries(Array.from({ length: 7 }, (_, index) => {
          const day = new Date(); day.setDate(day.getDate() - (6 - index));
          const label = day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          return { label, count: daily[label] ?? 0 };
        }));
      }
    } else { setClickCounts({}); setClickSeries([]); }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { void load(); }, [load]);

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !workspaceId) return;
    if (form.destination_url && !validHttpUrl(form.destination_url)) { setMessage('O link de destino precisa começar com http:// ou https://.'); return; }
    if (form.image_url && !validHttpUrl(form.image_url)) { setMessage('A URL da imagem não é válida.'); return; }
    if (form.video_url && !validHttpUrl(form.video_url)) { setMessage('A URL do vídeo não é válida.'); return; }
    setSaving(true); setMessage('');
    const { data: campaign, error } = await supabase.from('av_campaigns').insert({
      workspace_id: workspaceId,
      product_id: form.product_id || null,
      name: form.name.trim(),
      objective: form.objective,
      status: 'planned',
      channel: form.channel,
      copy_text: form.copy_text.trim() || null,
      destination_url: form.destination_url.trim() || null,
      image_url: form.image_url.trim() || null,
      video_url: form.video_url.trim() || null,
      posting_interval_seconds: Number(form.posting_interval_seconds),
      pause_after_posts: Number(form.pause_after_posts),
      pause_duration_minutes: Number(form.pause_duration_minutes),
    }).select('id').single();
    if (error) { setMessage(`Não foi possível salvar a campanha: ${error.message}`); setSaving(false); return; }

    if (form.destination_url) {
      const code = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
      const { error: linkError } = await supabase.from('av_tracking_links').insert({
        workspace_id: workspaceId,
        campaign_id: campaign.id,
        code,
        destination_url: form.destination_url.trim(),
        label: form.name.trim(),
      });
      if (linkError) setMessage(`Campanha salva, mas o link rastreável não foi criado: ${linkError.message}`);
      else setMessage('Campanha salva no banco e link rastreável criado.');
    } else setMessage('Campanha salva no banco. Adicione um link de destino para habilitar rastreamento de cliques.');

    setForm({ name: '', product_id: '', objective: 'organic_traffic', channel: 'facebook_group', copy_text: '', destination_url: '', image_url: '', video_url: '', posting_interval_seconds: 360, pause_after_posts: 0, pause_duration_minutes: 0 });
    setSaving(false);
    await load();
  }

  async function markPostPublished(post: ScheduledPost) {
    if (!supabase || !workspaceId) return;
    const publishedUrl = window.prompt('Cole o link da publicação realizada (opcional):', post.destination_url ?? '');
    if (publishedUrl === null) return;
    if (publishedUrl.trim() && !validHttpUrl(publishedUrl.trim())) { setMessage('O link da publicação precisa ser uma URL http/https válida.'); return; }
    const { error } = await supabase.from('av_campaign_posts').update({
      status: 'published', published_at: new Date().toISOString(), published_url: publishedUrl.trim() || null,
    }).eq('id', post.id).eq('workspace_id', workspaceId);
    if (error) setMessage(`Não foi possível registrar a publicação: ${error.message}`);
    else { setMessage('Publicação registrada manualmente.'); await load(); }
  }

  async function cancelPost(post: ScheduledPost) {
    if (!supabase || !workspaceId) return;
    const { error } = await supabase.from('av_campaign_posts').update({ status: 'cancelled' }).eq('id', post.id).eq('workspace_id', workspaceId);
    if (error) setMessage(`Não foi possível cancelar o lembrete: ${error.message}`);
    else await load();
  }

  async function generateReminders(campaign: Campaign) {
    if (!supabase || !workspaceId || !campaign.copy_text) {
      setMessage('Esta campanha precisa ter uma copy salva antes de gerar lembretes.');
      return;
    }
    const count = Math.min(30, Math.max(1, Number(scheduleCount) || 1));
    const start = new Date(scheduleStart);
    if (!Number.isFinite(start.getTime())) { setMessage('Informe uma data e horário válidos.'); return; }
    const interval = Math.max(0, campaign.posting_interval_seconds || 0);
    const pauseEvery = Math.max(0, campaign.pause_after_posts || 0);
    const pauseMs = Math.max(0, campaign.pause_duration_minutes || 0) * 60000;
    let next = start.getTime();
    const rows = [];
    for (let i = 0; i < count; i++) {
      rows.push({
        workspace_id: workspaceId,
        campaign_id: campaign.id,
        channel: campaign.status === 'archived' ? 'manual' : 'manual',
        scheduled_at: new Date(next).toISOString(),
        status: 'scheduled',
        copy_snapshot: campaign.copy_text,
        media_url: campaign.image_url || campaign.video_url,
        destination_url: campaign.destination_url,
      });
      next += interval * 1000;
      if (pauseEvery > 0 && (i + 1) % pauseEvery === 0 && i + 1 < count) next += pauseMs;
    }
    const { error } = await supabase.from('av_campaign_posts').insert(rows);
    if (error) setMessage(`Não foi possível salvar os lembretes: ${error.message}`);
    else { setMessage(`${rows.length} lembrete(s) persistido(s) no calendário. A publicação continua manual.`); setScheduleOpen(null); }
  }

  return <div className="av-page">
    <section className="av-page-heading">
      <div><span className="av-eyebrow"><Megaphone size={14}/> CAMPANHAS OPERACIONAIS</span><h1>Campanhas</h1><p>Copy, produto, mídia, destino, link rastreável e calendário persistidos no Supabase.</p></div>
      <button className="av-button secondary" onClick={() => void load()}><RefreshCw size={15}/> Atualizar</button>
    </section>
    {message && <div className="av-message" role="status">{message}</div>}
    <section className="av-panel">
      <h2><Plus size={18}/> Criar campanha real</h2>
      <form className="av-form" onSubmit={createCampaign}>
        <label>Nome da campanha<input required maxLength={180} value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Ex.: Psicopedagogia — avaliação inicial"/></label>
        <div className="av-form-grid">
          <label>Produto<select value={form.product_id} onChange={e => setForm({...form,product_id:e.target.value})}><option value="">Sem produto vinculado</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Canal<select value={form.channel} onChange={e => setForm({...form,channel:e.target.value})}><option value="facebook_group">Grupo do Facebook (manual)</option><option value="instagram">Instagram (manual)</option><option value="facebook_page">Página do Facebook</option><option value="whatsapp">WhatsApp (opt-in)</option><option value="other">Outro</option></select></label>
        </div>
        <label>Copy / texto da publicação<textarea required rows={5} value={form.copy_text} onChange={e => setForm({...form,copy_text:e.target.value})} placeholder="Escreva o texto que será usado na publicação."/></label>
        <label>Link de compra / destino<input type="url" value={form.destination_url} onChange={e => setForm({...form,destination_url:e.target.value})} placeholder="https://..."/></label>
        <div className="av-form-grid">
          <label>URL da imagem<input type="url" value={form.image_url} onChange={e => setForm({...form,image_url:e.target.value})} placeholder="https://..."/></label>
          <label>URL do vídeo<input type="url" value={form.video_url} onChange={e => setForm({...form,video_url:e.target.value})} placeholder="https://..."/></label>
        </div>
        <div className="av-form-grid three">
          <label>Intervalo do calendário (segundos)<input type="number" min="0" max="86400" value={form.posting_interval_seconds} onChange={e => setForm({...form,posting_interval_seconds:Number(e.target.value)})}/></label>
          <label>Pausa após N lembretes<input type="number" min="0" max="1000" value={form.pause_after_posts} onChange={e => setForm({...form,pause_after_posts:Number(e.target.value)})}/></label>
          <label>Duração da pausa (minutos)<input type="number" min="0" max="1440" value={form.pause_duration_minutes} onChange={e => setForm({...form,pause_duration_minutes:Number(e.target.value)})}/></label>
        </div>
        <p className="av-note">O intervalo e as pausas organizam lembretes editoriais; não disparam postagens nem tentam contornar limites das plataformas.</p>
        <button className="av-button primary" disabled={saving}>{saving ? 'Salvando no banco…' : 'Salvar campanha'}</button>
      </form>
    </section>
    <section className="av-panel">
      <div className="av-panel-title"><h2>Campanhas salvas</h2><span>{campaigns.length} registro(s)</span></div>
      {loading ? <p className="av-empty">Consultando Supabase…</p> : campaigns.length === 0 ? <p className="av-empty">Nenhuma campanha cadastrada. Crie a primeira acima.</p> :
        <div className="av-list">{campaigns.map(campaign => {
          const link = links.find(item => item.campaign_id === campaign.id);
          const clicks = link ? (clickCounts[link.id] ?? 0) : 0;
          return <article className="av-list-row" key={campaign.id}>
            <div className="av-list-main"><strong>{campaign.name}</strong><small>{campaign.status} · {campaign.channel} · {campaign.posting_interval_seconds}s de intervalo</small><p>{campaign.copy_text || 'Sem copy cadastrada.'}</p>
              {link && <div className="av-track-row"><code>{CLICK_URL}{link.code}</code><button className="av-icon-button" title="Copiar link rastreável" onClick={() => void navigator.clipboard.writeText(CLICK_URL + link.code)}><Copy size={15}/></button><span>{clicks} clique(s) registrado(s)</span><a href={LEAD_URL + link.code} target="_blank" rel="noreferrer">Abrir formulário de lead</a><button className="av-icon-button" title="Copiar formulário de lead" onClick={() => void navigator.clipboard.writeText(LEAD_URL + link.code)}><Copy size={15}/></button></div>}{leadsByCampaign[campaign.id] && <p className="av-lead-summary"><strong>{leadsByCampaign[campaign.id].count} lead(s) com consentimento</strong>{leadsByCampaign[campaign.id].cities.length ? ` · Cidades informadas: ${leadsByCampaign[campaign.id].cities.join(', ')}` : ' · Nenhuma cidade informada ainda'}</p>}
            </div>
            <button className="av-button secondary small" onClick={() => { setScheduleOpen(scheduleOpen === campaign.id ? null : campaign.id); setScheduleStart(localDateTimeValue(new Date(Date.now()+3600000))); }}><CalendarClock size={15}/> Lembretes</button>
            {scheduleOpen === campaign.id && <div className="av-schedule">
              <label>Quantidade de lembretes<input type="number" min="1" max="30" value={scheduleCount} onChange={e => setScheduleCount(Number(e.target.value))}/></label>
              <label>Primeiro horário<input type="datetime-local" value={scheduleStart} onChange={e => setScheduleStart(e.target.value)}/></label>
              <button className="av-button primary small" onClick={() => void generateReminders(campaign)}>Salvar no calendário</button>
              <small>Serão criados lembretes persistentes. Nenhuma postagem será enviada automaticamente.</small>
            </div>}
          </article>;
        })}</div>}
    </section>
    <section className="av-panel">
      <div className="av-panel-title"><h2>Cliques reais — últimos 7 dias</h2><span>Eventos registrados pelo link de rastreamento</span></div>
      {clickSeries.length === 0 ? <p className="av-empty">Ainda não há cliques registrados nos links desta campanha. Os dados aparecerão após o primeiro acesso real.</p> :
        <div className="av-click-chart">{clickSeries.map(day => {
          const max = Math.max(1, ...clickSeries.map(item => item.count));
          return <div className="av-click-day" key={day.label}><span>{day.count}</span><i style={{ height: `${Math.max(3, day.count / max * 100)}%` }}/><small>{day.label}</small></div>;
        })}</div>}
      <p className="av-note">O rastreamento registra cliques, origem de referência e tipo de dispositivo. A cidade não é inferida por IP; poderá ser exibida quando a pessoa informar voluntariamente sua cidade em um formulário de lead.</p>
    </section>
    <section className="av-panel">
      <div className="av-panel-title"><h2>Calendário de publicações</h2><span>{scheduledPosts.filter(post => post.status === 'scheduled').length} lembrete(s) pendente(s)</span></div>
      <p className="av-note">Os horários permanecem salvos mesmo após atualizar a página. A publicação é manual: abra o grupo ou canal, publique respeitando as regras e depois registre o resultado aqui.</p>
      {scheduledPosts.length === 0 ? <p className="av-empty">Nenhum lembrete agendado.</p> :
        <div className="av-list">{scheduledPosts.map(post => {
          const campaign = campaigns.find(item => item.id === post.campaign_id);
          return <article className="av-list-row" key={post.id}>
            <div className="av-list-main"><strong>{campaign?.name ?? 'Campanha'}</strong><small>{new Date(post.scheduled_at).toLocaleString('pt-BR')} · {post.status}</small><p>{post.copy_snapshot}</p>{post.published_url && <a href={post.published_url} target="_blank" rel="noreferrer">Ver publicação registrada <ExternalLink size={12}/></a>}</div>
            {post.status === 'scheduled' && <div className="av-row-actions"><button className="av-button primary small" onClick={() => void markPostPublished(post)}>Registrar publicado</button><button className="av-button secondary small" onClick={() => void cancelPost(post)}>Cancelar</button></div>}
          </article>;
        })}</div>}
    </section>
  </div>;
}

export function CommunitiesPage({ workspaceId }: { workspaceId: string | null }) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', url: '', topic: 'Psicopedagogia', rules_url: '', notes: '' });

  const load = useCallback(async () => {
    if (!supabase || !workspaceId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from('av_communities').select('id,name,url,topic,status,notes').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
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
      workspace_id: workspaceId, name: form.name.trim(), url: form.url.trim(),
      normalized_url: normalized, topic: form.topic.trim() || 'Geral',
      rules_url: form.rules_url.trim() || null, notes: form.notes.trim() || null,
    });
    if (error?.code === '23505') setMessage('Este grupo já está cadastrado neste workspace. Não foi criado um duplicado.');
    else if (error) setMessage(`Não foi possível salvar o grupo: ${error.message}`);
    else { setMessage('Grupo salvo. Revise as regras antes de qualquer publicação.'); setForm({ name: '', url: '', topic: 'Psicopedagogia', rules_url: '', notes: '' }); await load(); }
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
          <div className="av-list-main"><strong>{item.name}</strong><small>{item.topic} · {item.status}</small><a href={item.url} target="_blank" rel="noreferrer">{item.url} <ExternalLink size={12}/></a>{item.notes && <p>{item.notes}</p>}</div>
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


export function PostsPage({ workspaceId }: { workspaceId: string | null }) {
  const [rows, setRows] = useState<{id:string;campaign_id:string;scheduled_at:string;status:string;copy_snapshot:string;destination_url:string|null;published_url:string|null}[]>([]);
  const [campaignNames, setCampaignNames] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!supabase || !workspaceId) { setRows([]); setLoading(false); return; }
    setLoading(true); setError('');
    const [posts,campaigns] = await Promise.all([
      supabase.from('av_campaign_posts').select('id,campaign_id,scheduled_at,status,copy_snapshot,destination_url,published_url').eq('workspace_id',workspaceId).order('scheduled_at',{ascending:false}).limit(200),
      supabase.from('av_campaigns').select('id,name').eq('workspace_id',workspaceId)
    ]);
    if(posts.error) setError(posts.error.message); else setRows(posts.data ?? []);
    setCampaignNames(Object.fromEntries((campaigns.data ?? []).map((c:{id:string;name:string})=>[c.id,c.name])));
    setLoading(false);
  },[workspaceId]);
  useEffect(()=>{void load();},[load]);
  const published=rows.filter(r=>r.status==='published').length;
  const pending=rows.filter(r=>r.status==='scheduled').length;
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
      <div className="av-list">{rows.map(row=><article className="av-list-row" key={row.id}><div className="av-list-main"><strong>{campaignNames[row.campaign_id] || 'Campanha'}</strong><small>{new Date(row.scheduled_at).toLocaleString('pt-BR')} · {row.status}</small><p>{row.copy_snapshot}</p>{(row.published_url || row.destination_url) && <a href={row.published_url || row.destination_url || '#'} target="_blank" rel="noreferrer">{row.published_url ? 'Abrir publicação registrada' : 'Abrir destino' } <ExternalLink size={12}/></a>}</div><span className={'post-status '+row.status}>{row.status==='published'?'Publicado':row.status==='scheduled'?'Pendente':row.status==='failed'?'Falhou':row.status}</span></article>)}</div>}
    </section>
    <p className="av-note">A plataforma registra apenas status e URLs informados ou retornados por integrações oficiais. Impressões, respostas e curtidas só serão exibidas quando uma API autorizada fornecer esses eventos.</p>
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
 const [events,setEvents]=useState<{id:number;event_type:string;created_at:string;tracking_link_id:string;referrer_host:string|null}[]>([]),[leads,setLeads]=useState<{id:string;campaign_id:string|null;created_at:string}[]>([]),[posts,setPosts]=useState<{id:string;status:string;channel:string;created_at:string}[]>([]),[links,setLinks]=useState<Record<string,string>>({}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{if(!supabase||!workspaceId){setLoading(false);return;}setLoading(true);const [e,l,p,k]=await Promise.all([supabase.from('av_tracking_events').select('id,event_type,created_at,tracking_link_id,referrer_host').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(1000),supabase.from('av_leads').select('id,campaign_id,created_at').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(1000),supabase.from('av_campaign_posts').select('id,status,channel,created_at').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(500),supabase.from('av_tracking_links').select('id,label,code').eq('workspace_id',workspaceId)]);const errors=[e.error,l.error,p.error,k.error].filter(Boolean);if(errors.length)setError(errors.map(x=>x?.message).join(' · '));else setError('');setEvents((e.data??[]) as typeof events);setLeads((l.data??[]) as typeof leads);setPosts((p.data??[]) as typeof posts);setLinks(Object.fromEntries((k.data??[]).map((x:{id:string;label:string|null;code:string})=>[x.id,x.label||x.code])));setLoading(false);},[workspaceId]);
 useEffect(()=>{void load();},[load]);
 const clicks=events.filter(x=>x.event_type==='click').length,conversions=events.filter(x=>x.event_type==='sale').length;
 const last7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const key=d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});const day=d.toDateString();return {key,count:events.filter(e=>e.event_type==='click'&&new Date(e.created_at).toDateString()===day).length};});
 const max=Math.max(1,...last7.map(x=>x.count));
 return <div className="av-page"><section className="av-page-heading"><div><span className="av-eyebrow">DESEMPENHO E ATRIBUIÇÃO</span><h1>Analytics</h1><p>Métricas reais recebidas dos links rastreáveis, formulários e registros de publicação.</p></div><button className="av-button secondary" onClick={()=>void load()}><RefreshCw size={15}/> Atualizar</button></section>
 {error&&<p className="av-message">{error}</p>}<section className="posts-stats"><article className="av-panel"><small>Cliques registrados</small><strong>{clicks}</strong></article><article className="av-panel"><small>Leads capturados</small><strong>{leads.length}</strong></article><article className="av-panel"><small>Vendas atribuídas</small><strong>{conversions}</strong></article><article className="av-panel"><small>Posts registrados</small><strong>{posts.length}</strong></article></section>
 <section className="av-panel"><h2>Cliques por dia · últimos 7 dias</h2>{loading?<p className="av-empty">Carregando métricas…</p>:<div className="av-bars">{last7.map(d=><div className="av-bar-column" key={d.key}><strong>{d.count}</strong><div className="av-bar-track"><i style={{height:(d.count/max*100)+'%'}}/></div><small>{d.key}</small></div>)}</div>}</section>
 <section className="av-panel"><h2>Atividade recente</h2>{events.length===0?<p className="av-empty">Ainda não existem cliques registrados. Crie links rastreáveis e compartilhe-os para começar a medir.</p>:<div className="av-list">{events.slice(0,30).map(e=><article className="av-list-row" key={e.id}><div className="av-list-main"><strong>{e.event_type==='click'?'Clique':e.event_type==='lead'?'Lead':'Venda'}</strong><small>{links[e.tracking_link_id]||'Link rastreável'} · {new Date(e.created_at).toLocaleString('pt-BR')}</small><p>{e.referrer_host||'Origem não informada'}</p></div></article>)}</div>}</section>
 <p className="av-note">Os números representam somente eventos recebidos e armazenados pelo AutoViral. Impressões e interações dentro de redes sociais dependem de APIs oficiais e permissões concedidas.</p></div>;
}


export function IntegrationsPage({workspaceId}:{workspaceId:string|null}){
 const [rows,setRows]=useState<{id:string;provider:string;account_label:string|null;status:string;scopes:string[];last_checked_at:string|null}[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[connecting,setConnecting]=useState(false);
 const providers=[{id:'facebook',name:'Facebook',detail:'Páginas e ativos Meta'},{id:'instagram',name:'Instagram',detail:'Contas profissionais elegíveis'},{id:'youtube',name:'YouTube',detail:'Canal e dados do YouTube'},{id:'pinterest',name:'Pinterest',detail:'Pins e analytics'},{id:'tiktok',name:'TikTok',detail:'Conta e conteúdo' }];
 const load=useCallback(async()=>{if(!supabase||!workspaceId){setLoading(false);return;}setLoading(true);const {data,error}=await supabase.from('av_integrations').select('id,provider,account_label,status,scopes,last_checked_at').eq('workspace_id',workspaceId);if(error)setError(error.message);else{setRows((data??[]) as typeof rows);setError('');}setLoading(false);},[workspaceId]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{const params=new URLSearchParams(window.location.search);const result=params.get('meta_connection');if(result){setError(result==='success'?'Meta conectado com sucesso. Atualize para confirmar os ativos autorizados.':`Falha na conexão Meta: ${params.get('reason')||'verifique permissões e configuração do aplicativo.'}`);void load();params.delete('meta_connection');params.delete('reason');const query=params.toString();window.history.replaceState({},'',window.location.pathname+(query?'?'+query:''));}},[load]);
 const connectMeta=async()=>{if(!supabase||!workspaceId){setError('Entre no workspace do AutoViral antes de conectar.');return;}setConnecting(true);setError('');try{const {data,error}=await supabase.functions.invoke('av-meta-oauth-start',{body:{}});if(error)throw error;if(!data?.auth_url)throw new Error(data?.error||'O backend não retornou a URL de autorização.');window.location.assign(data.auth_url);}catch(e){setError(e instanceof Error?e.message:'Não foi possível iniciar a conexão Meta.');setConnecting(false);}};
 return <div className="av-page"><section className="av-page-heading"><div><span className="av-eyebrow">CANAIS E AUTORIZAÇÕES</span><h1>Integrações</h1><p>Conecte contas por autorização oficial. Tokens permanecem protegidos no backend.</p></div><button className="av-button secondary" onClick={()=>void load()}><RefreshCw size={15}/> Atualizar</button></section>
 {error&&<p className="av-message">{error}</p>}<section className="integration-grid">{providers.map(p=>{const match=rows.find(r=>r.provider.toLowerCase()===p.id),connected=match?.status==='connected';return <article className="av-panel integration-card" key={p.id}><div className="integration-card-top"><span className={'integration-logo '+p.id}>{p.name.slice(0,2)}</span><span className={'post-status '+(connected?'published':'scheduled')}>{loading?'Consultando':connected?'Conectado':match?.status||'Desconectado'}</span></div><h2>{p.name}</h2><p>{p.detail}</p>{match?.account_label&&<small>{match.account_label}</small>}{match?.last_checked_at&&<small>Verificado: {new Date(match.last_checked_at).toLocaleString('pt-BR')}</small>}{p.id==='facebook'||p.id==='instagram'?<button className="av-button secondary" disabled={connecting} onClick={()=>void connectMeta()}>{connecting?'Abrindo Meta…':connected?'Reconectar Meta':'Conectar com Meta'}</button>:<button className="av-button secondary" disabled>{'Integração ainda não configurada'}</button>}</article>;})}</section>
 <p className="av-note">Facebook e Instagram compartilham a autorização Meta. O botão abre o domínio oficial do Meta; nenhuma senha é solicitada pelo AutoViral.</p></div>;
}
