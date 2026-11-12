import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowUpRight, BarChart3, Bell, Bot, BrainCircuit,
  ChevronDown, CircleHelp, Command, Compass, ContactRound, FileImage, Globe2,
  LayoutDashboard, Link2, LogOut, Menu, Package, Plus,
  Search, Settings2, ShieldCheck, Sparkles, Target, Users, WandSparkles, X,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';

type Section = 'Visão geral' | 'Produtos' | 'Inteligência de mercado' | 'Radar de audiência' | 'Central de tráfego' | 'Estúdio criativo' | 'CRM e vendas' | 'Funis e páginas' | 'Automações' | 'Analytics' | 'Integrações';
const sections: { label: Section; icon: typeof LayoutDashboard; group: string }[] = [
  { label: 'Visão geral', icon: LayoutDashboard, group: 'WORKSPACE' },
  { label: 'Produtos', icon: Package, group: 'ESTRATÉGIA' },
  { label: 'Inteligência de mercado', icon: BrainCircuit, group: 'ESTRATÉGIA' },
  { label: 'Radar de audiência', icon: Compass, group: 'ESTRATÉGIA' },
  { label: 'Central de tráfego', icon: Globe2, group: 'CRESCIMENTO' },
  { label: 'Estúdio criativo', icon: WandSparkles, group: 'CRESCIMENTO' },
  { label: 'CRM e vendas', icon: ContactRound, group: 'CRESCIMENTO' },
  { label: 'Funis e páginas', icon: Link2, group: 'CRESCIMENTO' },
  { label: 'Automações', icon: Bot, group: 'INTELIGÊNCIA' },
  { label: 'Analytics', icon: BarChart3, group: 'INTELIGÊNCIA' },
  { label: 'Integrações', icon: Settings2, group: 'SISTEMA' },
];

const metrics = [
  { label: 'Visitantes orgânicos', value: '—', change: 'Aguardando conexão', icon: Users, tone: 'cyan' },
  { label: 'Leads capturados', value: '—', change: 'Aguardando conexão', icon: Target, tone: 'purple' },
  { label: 'Cliques rastreados', value: '—', change: 'Aguardando conexão', icon: Activity, tone: 'green' },
  { label: 'Vendas atribuídas', value: '—', change: 'Aguardando conexão', icon: BarChart3, tone: 'orange' },
];

function App() {
  const [active, setActive] = useState<Section>('Visão geral');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState('Meu workspace');
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadOrCreateWorkspace(userId: string) {
    if (!supabase) return;
    const { data: membership, error: membershipError } = await supabase
      .from('av_workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (membershipError) { console.error('Falha ao consultar workspace:', membershipError.message); return; }
    if (membership?.workspace_id) {
      const { data: workspace } = await supabase.from('av_workspaces').select('name').eq('id', membership.workspace_id).single();
      if (workspace?.name) setWorkspaceName(workspace.name);
      return;
    }
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
    const { data: workspace, error: workspaceError } = await supabase
      .from('av_workspaces')
      .insert({ name: 'Meu workspace', slug: `av-${suffix}`, owner_id: userId })
      .select('id,name')
      .single();
    if (workspaceError || !workspace) { console.error('Falha ao criar workspace:', workspaceError?.message); return; }
    const { error: memberError } = await supabase.from('av_workspace_members').insert({ workspace_id: workspace.id, user_id: userId, role: 'owner' });
    if (memberError) { console.error('Falha ao registrar proprietário do workspace:', memberError.message); return; }
    setWorkspaceName(workspace.name);
  }

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      setUserEmail(session?.user.email ?? null);
      if (session?.user.id) void loadOrCreateWorkspace(session.user.id);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      if (session?.user.id) window.setTimeout(() => void loadOrCreateWorkspace(session.user.id), 0);
      else setWorkspaceName('Meu workspace');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const grouped = useMemo(() => sections.reduce<Record<string, typeof sections>>((acc, item) => {
    (acc[item.group] ??= []).push(item); return acc;
  }, {}), []);

  async function authenticate(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true); setAuthMessage('');
    const result = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (result.error) setAuthMessage(result.error.message);
    else if (authMode === 'signup') setAuthMessage('Conta criada. Verifique seu e-mail para confirmar o acesso.');
  }

  async function signOut() { await supabase?.auth.signOut(); setUserEmail(null); }

  if (!authReady) return <div className="loading-screen"><div className="brand-mark"><Sparkles /></div><span>Preparando seu workspace…</span></div>;
  if (isSupabaseConfigured && !userEmail) return (
    <main className="auth-screen">
      <div className="auth-panel">
        <Brand />
        <div className="auth-copy"><span className="eyebrow">SEU CENTRO DE CRESCIMENTO</span><h1>Transforme estratégia em <em>crescimento orgânico.</em></h1><p>Acesse seu workspace para planejar, criar, distribuir e acompanhar sua operação.</p></div>
        <form onSubmit={authenticate} className="auth-form">
          <h2>{authMode === 'login' ? 'Entrar na plataforma' : 'Criar sua conta'}</h2>
          <label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="voce@empresa.com" /></label>
          <label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Mínimo de 8 caracteres" /></label>
          {authMessage && <p className="auth-message">{authMessage}</p>}
          <button className="primary-button full" disabled={loading}>{loading ? 'Aguarde…' : authMode === 'login' ? 'Entrar' : 'Criar conta'}</button>
          <button type="button" className="text-button" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthMessage(''); }}>{authMode === 'login' ? 'Ainda não tem conta? Criar acesso' : 'Já tem uma conta? Entrar'}</button>
        </form>
        <small className="auth-foot"><ShieldCheck size={14} /> Acesso protegido por autenticação Supabase</small>
      </div>
      <div className="auth-art"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-core"><Sparkles size={42} /></div><div className="art-label label-one"><Activity size={16} /> Tráfego orgânico</div><div className="art-label label-two"><BrainCircuit size={16} /> Inteligência artificial</div><div className="art-label label-three"><Target size={16} /> Conversão</div></div>
    </main>
  );

  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-scrim" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-top"><Brand /><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)}><X /></button></div>
        <button className="workspace-switch"><span className="workspace-avatar">AV</span><span><strong>{workspaceName}</strong><small>Plano inicial</small></span><ChevronDown size={16} /></button>
        <nav>
          {Object.entries(grouped).map(([group, items]) => <div className="nav-group" key={group}><span className="nav-label">{group}</span>{items.map(item => { const Icon = item.icon; return <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => { setActive(item.label); setMobileOpen(false); }}><Icon size={18} /><span>{item.label}</span>{item.label === 'Automações' && <span className="nav-dot" />}</button>; })}</div>)}
        </nav>
        <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18} /></div><strong>Precisa de ajuda?</strong><span>Explore os recursos da plataforma.</span><button onClick={() => setActive('Integrações')}>Central de ajuda <ArrowUpRight size={14} /></button></div><div className="profile-row"><div className="profile-avatar">M</div><div className="profile-info"><strong>{userEmail ? userEmail.split('@')[0] : 'Administrador'}</strong><small>{userEmail ?? 'Workspace proprietário'}</small></div><button className="icon-button" title="Sair" onClick={signOut}><LogOut size={16} /></button></div></div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="topbar-left"><button className="icon-button menu-toggle" onClick={() => setMobileOpen(true)}><Menu /></button><div className="breadcrumb">AutoViral AI <span>/</span> <strong>{active}</strong></div></div><div className="topbar-actions"><div className="search-box"><Search size={16} /><input placeholder="Buscar recursos..." /><kbd>⌘ K</kbd></div><button className="icon-button notification-button"><Bell size={18} /><i /></button><div className="top-avatar">M</div></div></header>
        <div className="page-content">
          <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> WORKSPACE EM CONFIGURAÇÃO</div><h1>{active === 'Visão geral' ? 'Seu crescimento começa aqui.' : active}</h1><p>{active === 'Visão geral' ? 'Uma visão unificada da sua operação de tráfego, audiência e vendas.' : 'Organize sua operação e prepare o próximo passo do crescimento orgânico.'}</p></div><button className="primary-button" onClick={() => setActive('Produtos')}><Plus size={17} /> Novo projeto</button></section>
          <section className="setup-banner"><div className="banner-icon"><Sparkles size={21} /></div><div className="banner-copy"><strong>Bem-vindo ao AutoViral AI</strong><span>Seu ambiente visual está pronto. Conecte as fontes de dados para ativar métricas reais e recursos operacionais.</span></div><span className="setup-status">CONFIGURAÇÃO INICIAL</span></section>
          <section className="metric-grid">{metrics.map((m) => { const Icon = m.icon; return <article className="metric-card" key={m.label}><div className="metric-head"><span>{m.label}</span><span className={`metric-icon ${m.tone}`}><Icon size={18} /></span></div><strong className="metric-value">{m.value}</strong><div className="metric-foot"><span className="muted-dot" />{m.change}</div></article>; })}</section>
          <div className="content-grid"><section className="panel performance-panel"><div className="panel-heading"><div><span className="panel-kicker">VISÃO DA OPERAÇÃO</span><h2>Desempenho dos canais</h2></div><button className="subtle-button">Últimos 30 dias <ChevronDown size={15} /></button></div><div className="chart-placeholder"><div className="chart-lines"><i /><i /><i /><i /></div><div className="chart-empty"><div className="chart-empty-icon"><BarChart3 size={23} /></div><strong>Seus dados aparecerão aqui</strong><span>Conecte canais e rastreamento para visualizar o desempenho.</span></div><div className="chart-x"><span>01</span><span>07</span><span>14</span><span>21</span><span>30</span></div></div></section>
            <section className="panel channels-panel"><div className="panel-heading"><div><span className="panel-kicker">ECOSSISTEMA</span><h2>Canais conectados</h2></div><button className="icon-button"><Plus size={17} /></button></div><div className="channel-list">{[{name:'Instagram',desc:'Conteúdo e comunidade',letter:'ig',tone:'pink'},{name:'Facebook',desc:'Páginas e grupos',letter:'f',tone:'blue'},{name:'YouTube',desc:'Vídeos e audiência',letter:'▶',tone:'red'},{name:'Pinterest',desc:'Pins e descoberta',letter:'p',tone:'coral'},{name:'TikTok',desc:'Vídeos curtos',letter:'♪',tone:'dark'}].map(c=><div className="channel-row" key={c.name}><span className={`channel-logo ${c.tone}`}>{c.letter}</span><span className="channel-name"><strong>{c.name}</strong><small>{c.desc}</small></span><span className="disconnected">Não conectado</span></div>)}</div><button className="panel-link" onClick={() => setActive('Integrações')}>Gerenciar integrações <ArrowUpRight size={15} /></button></section></div>
          <section className="panel quickstart"><div className="panel-heading"><div><span className="panel-kicker">PRÓXIMOS PASSOS</span><h2>Monte sua operação</h2></div><span className="progress-label">0 de 4 concluídos</span></div><div className="progress-track"><i /></div><div className="steps-grid">{[{icon:Package,title:'Cadastre seu produto',desc:'Defina o que você quer divulgar.',action:'Abrir produtos',section:'Produtos' as Section},{icon:BrainCircuit,title:'Analise seu mercado',desc:'Encontre oportunidades e públicos.',action:'Explorar inteligência',section:'Inteligência de mercado' as Section},{icon:FileImage,title:'Crie seu primeiro conteúdo',desc:'Prepare uma peça para seus canais.',action:'Abrir estúdio',section:'Estúdio criativo' as Section},{icon:Link2,title:'Configure seu rastreamento',desc:'Prepare a atribuição de resultados.',action:'Ver integrações',section:'Integrações' as Section}].map((s,i)=>{const Icon=s.icon;return <article className="step-card" key={s.title}><div className="step-number">0{i+1}</div><div className="step-icon"><Icon size={19}/></div><strong>{s.title}</strong><span>{s.desc}</span><button onClick={()=>setActive(s.section)}>{s.action} <ArrowUpRight size={14}/></button></article>;})}</div></section>
          <footer className="footer"><span>AutoViral AI <b>·</b> Fase 1 — Fundação</span><span><ShieldCheck size={13}/> Ambiente seguro em preparação</span></footer>
        </div>
      </main>
    </div>
  );
}

function Brand() { return <div className="brand"><span className="brand-mark"><Command size={19}/></span><span>AUTO<span>VIRAL</span><small>AI</small></span></div>; }

export default App;