import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Plus, RefreshCw, Users, Megaphone, CalendarClock, Upload, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './operational-pages.css';

type ProductOption = { id: string; name: string };
type Campaign = {
  id: string; name: string; product_id: string | null; objective: string; status: string;
  copy_text: string | null; destination_url: string | null; image_url: string | null; video_url: string | null;
  posting_interval_seconds: number; pause_after_posts: number; pause_duration_minutes: number;
};
type TrackingLink = { id: string; campaign_id: string | null; code: string; destination_url: string; label: string | null };
type Community = { id: string; name: string; url: string; topic: string; status: string; notes: string | null };

const PROJECT_URL = 'https://nuyzvpkvawixidotuuio.supabase.co';
const CLICK_URL = `${PROJECT_URL}/functions/v1/av-click?c=`;

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
    const [productResult, campaignResult, linkResult] = await Promise.all([
      supabase.from('av_products').select('id,name').eq('workspace_id', workspaceId).order('name'),
      supabase.from('av_campaigns').select('id,name,product_id,objective,status,copy_text,destination_url,image_url,video_url,posting_interval_seconds,pause_after_posts,pause_duration_minutes').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('av_tracking_links').select('id,campaign_id,code,destination_url,label').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    ]);
    if (productResult.error) setMessage(`Produtos: ${productResult.error.message}`);
    if (campaignResult.error) setMessage(`Campanhas: ${campaignResult.error.message}`);
    if (linkResult.error) setMessage(`Links: ${linkResult.error.message}`);
    setProducts((productResult.data ?? []) as ProductOption[]);
    setCampaigns((campaignResult.data ?? []) as Campaign[]);
    setLinks((linkResult.data ?? []) as TrackingLink[]);
    const ids = (linkResult.data ?? []).map((item: TrackingLink) => item.id);
    if (ids.length) {
      const events = await supabase.from('av_tracking_events').select('tracking_link_id').in('tracking_link_id', ids);
      if (!events.error) {
        const counts: Record<string, number> = {};
        for (const event of events.data ?? []) counts[event.tracking_link_id] = (counts[event.tracking_link_id] ?? 0) + 1;
        setClickCounts(counts);
      }
    } else setClickCounts({});
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
              {link && <div className="av-track-row"><code>{CLICK_URL}{link.code}</code><button className="av-icon-button" title="Copiar link rastreável" onClick={() => void navigator.clipboard.writeText(CLICK_URL + link.code)}><Copy size={15}/></button><span>{clicks} clique(s) registrado(s)</span></div>}
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
