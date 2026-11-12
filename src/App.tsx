import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowUpRight, BarChart3, Bell, Bot, BrainCircuit, Megaphone,
  ChevronDown, CircleHelp, Command, Compass, ContactRound, FileImage, Globe2,
  LayoutDashboard, Link2, LogOut, Menu, Package, Plus, Sun, Moon, MessageSquare, Play, FileText, BookOpen, UploadCloud,
  Search, Settings2, ShieldCheck, Sparkles, Target, Users, WandSparkles, X, Pencil, Trash2, RefreshCw,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { CampaignsPage, CommunitiesPage, AudiencesPage, PostsPage, CRMPage, OpportunitiesPage, AnalyticsPage, IntegrationsPage } from './features/OperationalPages';

type Section = 'Visão geral' | 'Produtos' | 'Campanhas' | 'Grupos e oportunidades' | 'Inteligência de mercado' | 'Radar de audiência' | 'Central de tráfego' | 'Estúdio criativo' | 'CRM e vendas' | 'Funis e páginas' | 'Automações' | 'Analytics' | 'Integrações' | 'Públicos' | 'Importar' | 'Oportunidades' | 'Comentador' | 'YouTube' | 'Posts' | 'Gerador de link' | 'Tutorial';
type Product = {
  id: string;
  name: string;
  description: string | null;
  product_type: 'digital' | 'physical' | 'service' | 'affiliate';
  niche: string | null;
  price: number | null;
  currency: string;
  checkout_url: string | null;
  image_url: string | null;
  target_audience: string | null;
  benefits: string | null;
  bonuses: string | null;
  guarantee: string | null;
  promo_price: number | null;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
};
type ProductForm = {
  name: string;
  description: string;
  product_type: Product['product_type'];
  niche: string;
  price: string;
  currency: string;
  checkout_url: string;
  image_url: string;
  target_audience: string;
  benefits: string;
  bonuses: string;
  guarantee: string;
  promo_price: string;
  status: Product['status'];
};
const blankProduct: ProductForm = {
  name: '', description: '', product_type: 'digital', niche: '',
  price: '', currency: 'BRL', checkout_url: '', image_url: '', target_audience: '', benefits: '', bonuses: '', guarantee: '', promo_price: '', status: 'draft',
};
const sections: { label: Section; icon: typeof LayoutDashboard; group: string }[] = [
  { label: 'Visão geral', icon: LayoutDashboard, group: 'WORKSPACE' },
  { label: 'Produtos', icon: Package, group: 'ESTRATÉGIA' },
  { label: 'Campanhas', icon: Megaphone, group: 'CRESCIMENTO' },
  { label: 'Públicos', icon: Users, group: 'ESTRATÉGIA' },
  { label: 'Importar', icon: UploadCloud, group: 'ESTRATÉGIA' },
  { label: 'Grupos e oportunidades', icon: Users, group: 'ESTRATÉGIA' },
  { label: 'Oportunidades', icon: Target, group: 'ESTRATÉGIA' },
  { label: 'Inteligência de mercado', icon: BrainCircuit, group: 'ESTRATÉGIA' },
  { label: 'Radar de audiência', icon: Compass, group: 'ESTRATÉGIA' },
  { label: 'Central de tráfego', icon: Globe2, group: 'CRESCIMENTO' },
  { label: 'Estúdio criativo', icon: WandSparkles, group: 'CRESCIMENTO' },
  { label: 'Comentador', icon: MessageSquare, group: 'CRESCIMENTO' },
  { label: 'YouTube', icon: Play, group: 'CRESCIMENTO' },
  { label: 'Posts', icon: FileText, group: 'RESULTADOS' },
  { label: 'CRM e vendas', icon: ContactRound, group: 'CRESCIMENTO' },
  { label: 'Funis e páginas', icon: Link2, group: 'CRESCIMENTO' },
  { label: 'Automações', icon: Bot, group: 'INTELIGÊNCIA' },
  { label: 'Analytics', icon: BarChart3, group: 'INTELIGÊNCIA' },
  { label: 'Gerador de link', icon: Link2, group: 'FERRAMENTAS' },
  { label: 'Tutorial', icon: BookOpen, group: 'FERRAMENTAS' },
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
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('av-theme') as 'dark' | 'light') || 'dark');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('av-theme', theme); }, [theme]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState('Meu workspace');
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [productMessage, setProductMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(blankProduct);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);

  async function loadOrCreateWorkspace(_userId: string) {
    if (!supabase) return;
    setWorkspaceError('');
    setWorkspaceLoading(true);
    try {
      const { data: memberships, error: membershipError } = await supabase
        .from('av_workspace_members')
        .select('workspace_id, av_workspaces(id,name)')
        .order('created_at', { ascending: true })
        .limit(1);
      if (membershipError) throw membershipError;

      const membership = memberships?.[0] as
        | { workspace_id: string; av_workspaces: { id: string; name: string }[] | null }
        | undefined;

      if (membership?.workspace_id) {
        const workspace = membership.av_workspaces?.[0] ?? null;
        if (!workspace) {
          const { data, error } = await supabase
            .from('av_workspaces').select('id,name').eq('id', membership.workspace_id).single();
          if (error) throw error;
          setWorkspaceName(data.name);
          setWorkspaceId(data.id);
        } else {
          setWorkspaceName(workspace.name);
          setWorkspaceId(workspace.id);
        }
        return;
      }

      const { data: newWorkspaceId, error: createError } = await supabase
        .rpc('av_create_workspace', { p_name: 'Meu workspace' });
      if (createError) throw createError;
      if (!newWorkspaceId) throw new Error('A criação do workspace não retornou um identificador.');

      const { data: createdWorkspace, error: fetchError } = await supabase
        .from('av_workspaces').select('id,name').eq('id', newWorkspaceId).single();
      if (fetchError) throw fetchError;
      setWorkspaceName(createdWorkspace.name);
      setWorkspaceId(createdWorkspace.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Falha ao preparar workspace:', message);
      setWorkspaceError(`Não foi possível preparar seu workspace: ${message}`);
      setWorkspaceId(null);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function loadProducts(targetWorkspaceId = workspaceId) {
    if (!supabase || !targetWorkspaceId) return;
    setProductsLoading(true);
    setProductsError('');
    const { data, error } = await supabase.from('av_products')
      .select('id,name,description,product_type,niche,price,currency,checkout_url,image_url,target_audience,benefits,bonuses,guarantee,promo_price,status,created_at')
      .eq('workspace_id', targetWorkspaceId).order('created_at', { ascending: false });
    if (error) setProductsError(`Não foi possível carregar os produtos: ${error.message}`);
    else setProducts((data ?? []) as Product[]);
    setProductsLoading(false);
  }

  function openNewProduct() {
    setEditingProductId(null);
    setProductForm(blankProduct);
    setProductImageFile(null);
    setProductMessage('');
    setFormOpen(true);
  }
  function openEditProduct(product: Product) {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name, description: product.description ?? '', product_type: product.product_type,
      niche: product.niche ?? '', price: product.price == null ? '' : String(product.price),
      currency: product.currency || 'BRL', checkout_url: product.checkout_url ?? '', image_url: product.image_url ?? '', target_audience: product.target_audience ?? '', benefits: product.benefits ?? '', bonuses: product.bonuses ?? '', guarantee: product.guarantee ?? '', promo_price: product.promo_price == null ? '' : String(product.promo_price), status: product.status,
    });
    setProductImageFile(null);
    setProductMessage('');
    setFormOpen(true);
  }
  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !workspaceId) { setProductMessage('Workspace ainda não está disponível. Recarregue a página e tente novamente.'); return; }
    const parsedPrice = productForm.price.trim() === '' ? null : Number(productForm.price.replace(',', '.'));
    const parsedPromoPrice = productForm.promo_price.trim() === '' ? null : Number(productForm.promo_price.replace(',', '.'));
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setProductMessage('Informe um preço válido, maior ou igual a zero.'); return;
    }
    if (parsedPromoPrice !== null && (!Number.isFinite(parsedPromoPrice) || parsedPromoPrice < 0)) { setProductMessage('Informe um preço promocional válido.'); return; }
    if (parsedPrice !== null && parsedPromoPrice !== null && parsedPromoPrice > parsedPrice) { setProductMessage('O preço promocional não pode ser maior que o preço original.'); return; }
    if (productImageFile && (!['image/jpeg','image/png','image/webp'].includes(productImageFile.type) || productImageFile.size > 5 * 1024 * 1024)) { setProductMessage('Envie uma imagem JPG, PNG ou WebP de até 5 MB.'); return; }
    if (productForm.checkout_url.trim()) {
      try {
        const url = new URL(productForm.checkout_url);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
      } catch { setProductMessage('Informe um endereço de checkout válido, começando com https://.'); return; }
    }
    setSavingProduct(true);
    setProductMessage('');
    let uploadedImageUrl = productForm.image_url.trim() || null;
    let uploadedImagePath: string | null = null;
    if (productImageFile) {
      const extension = productImageFile.type === 'image/png' ? 'png' : productImageFile.type === 'image/webp' ? 'webp' : 'jpg';
      const objectPath = `${workspaceId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('av-product-media').upload(objectPath, productImageFile, { contentType: productImageFile.type, cacheControl: '3600', upsert: false });
      if (uploadError) { setSavingProduct(false); setProductMessage(`Falha no upload da imagem: ${uploadError.message}`); return; }
      uploadedImagePath = objectPath;
      uploadedImageUrl = supabase.storage.from('av-product-media').getPublicUrl(objectPath).data.publicUrl;
    }
    const payload = {
      name: productForm.name.trim(), description: productForm.description.trim() || null,
      product_type: productForm.product_type, niche: productForm.niche.trim() || null,
      price: parsedPrice, currency: productForm.currency.toUpperCase(),
      checkout_url: productForm.checkout_url.trim() || null, image_url: uploadedImageUrl, target_audience: productForm.target_audience.trim() || null, benefits: productForm.benefits.trim() || null, bonuses: productForm.bonuses.trim() || null, guarantee: productForm.guarantee.trim() || null, promo_price: parsedPromoPrice, status: productForm.status,
    };
    const query = editingProductId
      ? supabase.from('av_products').update(payload).eq('id', editingProductId).eq('workspace_id', workspaceId)
      : supabase.from('av_products').insert({ ...payload, workspace_id: workspaceId });
    const { error } = await query;
    setSavingProduct(false);
    if (error) {
      if (uploadedImagePath) await supabase.storage.from('av-product-media').remove([uploadedImagePath]);
      setProductMessage(`Erro ao salvar produto: ${error.message}`); return;
    }
    setFormOpen(false);
    setProductImageFile(null);
    setProductMessage(editingProductId ? 'Produto atualizado.' : 'Produto cadastrado.');
    await loadProducts();
  }
  async function deleteProduct(product: Product) {
    if (!supabase || !workspaceId || !window.confirm(`Excluir "${product.name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('av_products').delete().eq('id', product.id).eq('workspace_id', workspaceId);
    if (error) setProductsError(`Não foi possível excluir: ${error.message}`);
    else { setProductMessage('Produto excluído.'); await loadProducts(); }
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
      else { setWorkspaceName('Meu workspace'); setWorkspaceId(null); setProducts([]); }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (active === 'Produtos' && workspaceId) void loadProducts(workspaceId); }, [active, workspaceId]);

  const grouped = useMemo(() => sections.reduce<Record<string, typeof sections>>((acc, item) => {
    (acc[item.group] ??= []).push(item); return acc;
  }, {}), []);

  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
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
      {workspaceError && <div role="alert" className="product-feedback error">{workspaceError} Atualize a página ou verifique a configuração do banco de dados.</div>}
      {workspaceLoading && <div role="status" className="product-feedback">Preparando seu workspace…</div>}
      {mobileOpen && <button className="mobile-scrim" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-top"><Brand /><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)}><X /></button></div>
        <button className="workspace-switch"><span className="workspace-avatar">AV</span><span><strong>{workspaceName}</strong><small>Plano inicial</small></span><ChevronDown size={16} /></button>
        <nav>
          {Object.entries(grouped).map(([group, items]) => <div className="nav-group" key={group}><span className="nav-label">{group}</span>{items.map(item => { const Icon = item.icon; return <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => { setActive(item.label); setMobileOpen(false); }}><Icon size={18} /><span>{item.label}</span>{item.label === 'Automações' && <span className="nav-dot" />}</button>; })}</div>)}
        </nav>
        <div className="sidebar-bottom"><button className="sidebar-help-compact" onClick={() => setActive('Tutorial')}><CircleHelp size={15}/> Ajuda e tutoriais <ArrowUpRight size={13}/></button><div className="profile-row"><div className="profile-avatar">M</div><div className="profile-info"><strong>{userEmail ? userEmail.split('@')[0] : 'Administrador'}</strong><small>{userEmail ?? 'Workspace proprietário'}</small></div><button className="icon-button" title="Sair" onClick={signOut}><LogOut size={16} /></button></div></div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="topbar-left"><button className="icon-button menu-toggle" onClick={() => setMobileOpen(true)}><Menu /></button><div className="breadcrumb">AutoViral AI <span>/</span> <strong>{active}</strong></div></div><div className="topbar-actions"><button className="icon-button" title="Alternar tema claro/escuro" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button><div className="search-box"><Search size={16} /><input placeholder="Buscar recursos..." /><kbd>⌘ K</kbd></div><button className="icon-button notification-button"><Bell size={18} /><i /></button><div className="top-avatar">M</div></div></header>
        <div className="page-content">
          {active === 'Públicos' ? <AudiencesPage workspaceId={workspaceId} /> : active === 'Integrações' ? <IntegrationsPage workspaceId={workspaceId} /> : active === 'Analytics' ? <AnalyticsPage workspaceId={workspaceId} /> : active === 'Posts' ? <PostsPage workspaceId={workspaceId} /> : active === 'CRM e vendas' ? <CRMPage workspaceId={workspaceId} /> : active === 'Oportunidades' ? <OpportunitiesPage workspaceId={workspaceId} /> : active !== 'Visão geral' && active !== 'Produtos' && active !== 'Campanhas' && active !== 'Grupos e oportunidades' ? (
            <WorkspaceSection active={active} onNavigate={setActive} />
          ) : active === 'Produtos' ? (
            <ProductsPage
              products={products} loading={productsLoading} error={productsError} message={productMessage}
              formOpen={formOpen} form={productForm} saving={savingProduct} imageFile={productImageFile} onImageFileChange={setProductImageFile}
              onNew={openNewProduct} onEdit={openEditProduct} onDelete={deleteProduct}
              onChange={setProductForm} onSave={saveProduct} onClose={() => setFormOpen(false)}
              onRefresh={() => void loadProducts()}
            />
          ) : active === 'Campanhas' ? <CampaignsPage workspaceId={workspaceId} /> : active === 'Grupos e oportunidades' ? <CommunitiesPage workspaceId={workspaceId} /> : <>
            <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> WORKSPACE EM CONFIGURAÇÃO</div><h1>{active === 'Visão geral' ? 'Seu crescimento começa aqui.' : active}</h1><p>{active === 'Visão geral' ? 'Uma visão unificada da sua operação de tráfego, audiência e vendas.' : 'Organize sua operação e prepare o próximo passo do crescimento orgânico.'}</p></div><button className="primary-button" onClick={() => setActive('Produtos')}><Plus size={17} /> Novo projeto</button></section>
            <section className="setup-banner"><div className="banner-icon"><Sparkles size={21} /></div><div className="banner-copy"><strong>Bem-vindo ao AutoViral AI</strong><span>Seu ambiente visual está pronto. Conecte as fontes de dados para ativar métricas reais e recursos operacionais.</span></div><span className="setup-status">CONFIGURAÇÃO INICIAL</span></section>
            <section className="metric-grid">{metrics.map((m) => { const Icon = m.icon; return <article className="metric-card" key={m.label}><div className="metric-head"><span>{m.label}</span><span className={`metric-icon ${m.tone}`}><Icon size={18} /></span></div><strong className="metric-value">{m.value}</strong><div className="metric-foot"><span className="muted-dot" />{m.change}</div></article>; })}</section>
            <div className="content-grid"><section className="panel performance-panel"><div className="panel-heading"><div><span className="panel-kicker">VISÃO DA OPERAÇÃO</span><h2>Desempenho dos canais</h2></div><button className="subtle-button">Últimos 30 dias <ChevronDown size={15} /></button></div><div className="chart-placeholder"><div className="chart-lines"><i /><i /><i /><i /></div><div className="chart-empty"><div className="chart-empty-icon"><BarChart3 size={23} /></div><strong>Seus dados aparecerão aqui</strong><span>Conecte canais e rastreamento para visualizar o desempenho.</span></div><div className="chart-x"><span>01</span><span>07</span><span>14</span><span>21</span><span>30</span></div></div></section>
              <section className="panel channels-panel"><div className="panel-heading"><div><span className="panel-kicker">ECOSSISTEMA</span><h2>Canais conectados</h2></div><button className="icon-button" title="Gerenciar canais" onClick={() => setActive('Integrações')}><Plus size={17} /></button></div><div className="channel-list">{[{name:'Instagram',desc:'Conteúdo e comunidade',letter:'ig',tone:'pink'},{name:'Facebook',desc:'Páginas e grupos',letter:'f',tone:'blue'},{name:'YouTube',desc:'Vídeos e audiência',letter:'▶',tone:'red'},{name:'Pinterest',desc:'Pins e descoberta',letter:'p',tone:'coral'},{name:'TikTok',desc:'Vídeos curtos',letter:'♪',tone:'dark'}].map(c=><div className="channel-row" key={c.name}><span className={`channel-logo ${c.tone}`}>{c.letter}</span><span className="channel-name"><strong>{c.name}</strong><small>{c.desc}</small></span><span className="disconnected">Não conectado</span></div>)}</div><button className="panel-link" onClick={() => setActive('Integrações')}>Gerenciar integrações <ArrowUpRight size={15} /></button></section></div>
            <section className="panel quickstart"><div className="panel-heading"><div><span className="panel-kicker">PRÓXIMOS PASSOS</span><h2>Monte sua operação</h2></div><span className="progress-label">0 de 4 concluídos</span></div><div className="progress-track"><i /></div><div className="steps-grid">{[{icon:Package,title:'Cadastre seu produto',desc:'Defina o que você quer divulgar.',action:'Abrir produtos',section:'Produtos' as Section},{icon:BrainCircuit,title:'Analise seu mercado',desc:'Encontre oportunidades e públicos.',action:'Explorar inteligência',section:'Inteligência de mercado' as Section},{icon:FileImage,title:'Crie seu primeiro conteúdo',desc:'Prepare uma peça para seus canais.',action:'Abrir estúdio',section:'Estúdio criativo' as Section},{icon:Link2,title:'Configure seu rastreamento',desc:'Prepare a atribuição de resultados.',action:'Ver integrações',section:'Integrações' as Section}].map((s,i)=>{const Icon=s.icon;return <article className="step-card" key={s.title}><div className="step-number">0{i+1}</div><div className="step-icon"><Icon size={19}/></div><strong>{s.title}</strong><span>{s.desc}</span><button onClick={()=>setActive(s.section)}>{s.action} <ArrowUpRight size={14}/></button></article>;})}</div></section>
            <footer className="footer"><span>AutoViral AI · Fase 2 — Product Center</span><span><ShieldCheck size={13}/> Dados isolados por workspace</span></footer>
          </>}
        </div>
      </main>
    </div>
  );
}


function WorkspaceSection({ active, onNavigate }: { active: Section; onNavigate: (section: Section) => void }) {
  const config: Partial<Record<Section, { eyebrow: string; title: string; description: string; items: { title: string; description: string; action: string; target: Section }[] }>> = {
    'Inteligência de mercado': { eyebrow: 'PESQUISA E POSICIONAMENTO', title: 'Inteligência de mercado', description: 'Organize referências, concorrentes, nichos e oportunidades antes de investir em uma campanha.', items: [
      { title: 'Grupos e comunidades', description: 'Revise os grupos mapeados e classifique oportunidades por tema.', action: 'Abrir grupos', target: 'Grupos e oportunidades' },
      { title: 'Produtos e ofertas', description: 'Consulte as ofertas cadastradas para orientar a pesquisa.', action: 'Ver produtos', target: 'Produtos' },
      { title: 'Radar de audiência', description: 'Avance para a análise de público e interesses.', action: 'Abrir radar', target: 'Radar de audiência' },
    ] },
    'Radar de audiência': { eyebrow: 'PÚBLICO E DESCOBERTA', title: 'Radar de audiência', description: 'Área de organização da audiência. Os dados de público serão exibidos quando houver fontes e eventos conectados.', items: [
      { title: 'Mapeamento de grupos', description: 'Use os grupos encontrados para identificar comunidades relevantes.', action: 'Ver grupos', target: 'Grupos e oportunidades' },
      { title: 'Canais', description: 'Confira o estado das conexões sociais e configure as integrações disponíveis.', action: 'Gerenciar canais', target: 'Integrações' },
      { title: 'Campanhas', description: 'Relacione públicos e comunidades às campanhas planejadas.', action: 'Abrir campanhas', target: 'Campanhas' },
    ] },
    'Central de tráfego': { eyebrow: 'DISTRIBUIÇÃO E RASTREAMENTO', title: 'Central de tráfego', description: 'Acompanhe links rastreáveis e campanhas. A publicação nas redes continua manual enquanto não houver integração oficial habilitada.', items: [
      { title: 'Campanhas', description: 'Crie campanhas e configure destino e rastreamento.', action: 'Abrir campanhas', target: 'Campanhas' },
      { title: 'Integrações', description: 'Consulte quais canais possuem conexão configurada.', action: 'Gerenciar integrações', target: 'Integrações' },
      { title: 'Analytics', description: 'Consulte eventos registrados pelos links rastreáveis.', action: 'Ver analytics', target: 'Analytics' },
    ] },
    'Estúdio criativo': { eyebrow: 'CONTEÚDO E CRIATIVOS', title: 'Estúdio criativo', description: 'Prepare textos, mídias e materiais para suas campanhas. Esta área ainda não possui editor criativo conectado.', items: [
      { title: 'Campanhas', description: 'Associe copy e mídia a uma campanha salva.', action: 'Abrir campanhas', target: 'Campanhas' },
      { title: 'Produtos', description: 'Consulte os produtos e suas informações de oferta.', action: 'Ver produtos', target: 'Produtos' },
      { title: 'Grupos e oportunidades', description: 'Escolha comunidades relevantes para sua distribuição.', action: 'Ver grupos', target: 'Grupos e oportunidades' },
    ] },
    'CRM e vendas': { eyebrow: 'RELACIONAMENTO E CONVERSÃO', title: 'CRM e vendas', description: 'Os leads capturados pelos formulários de campanha já podem ser registrados. O painel completo de contatos, etapas e histórico comercial ainda precisa ser implementado.', items: [
      { title: 'Campanhas e leads', description: 'Consulte campanhas, formulários e leads atribuídos.', action: 'Abrir campanhas', target: 'Campanhas' },
      { title: 'Produtos', description: 'Revise as ofertas associadas ao processo comercial.', action: 'Ver produtos', target: 'Produtos' },
      { title: 'Analytics', description: 'Acompanhe eventos e resultados registrados.', action: 'Ver analytics', target: 'Analytics' },
    ] },
    'Funis e páginas': { eyebrow: 'CAPTURA E JORNADA', title: 'Funis e páginas', description: 'Configure destinos e formulários de captura a partir das campanhas. Um construtor visual de páginas ainda não está disponível.', items: [
      { title: 'Campanhas', description: 'Configure o link de destino e o formulário de captura de leads.', action: 'Abrir campanhas', target: 'Campanhas' },
      { title: 'Produtos', description: 'Associe checkout e oferta ao destino da campanha.', action: 'Ver produtos', target: 'Produtos' },
      { title: 'Analytics', description: 'Acompanhe os cliques dos links rastreáveis.', action: 'Ver analytics', target: 'Analytics' },
    ] },
    'Automações': { eyebrow: 'FLUXOS OPERACIONAIS', title: 'Automações', description: 'Os fluxos automáticos ainda não estão ativos. Os lembretes de campanha são registros editoriais e não publicam conteúdo por conta própria.', items: [
      { title: 'Calendário de campanhas', description: 'Crie lembretes para organizar publicações manuais.', action: 'Abrir campanhas', target: 'Campanhas' },
      { title: 'Integrações', description: 'Confira as conexões necessárias para automatizar fluxos.', action: 'Gerenciar integrações', target: 'Integrações' },
    ] },
    'Analytics': { eyebrow: 'MÉTRICAS E ATRIBUIÇÃO', title: 'Analytics', description: 'As métricas reais dependem de eventos de rastreamento e leads capturados. Dados ainda não coletados serão identificados como indisponíveis, nunca estimados.', items: [
      { title: 'Campanhas', description: 'Veja cliques e leads associados aos links das campanhas.', action: 'Abrir campanhas', target: 'Campanhas' },
      { title: 'Central de tráfego', description: 'Configure destinos e links rastreáveis.', action: 'Abrir central', target: 'Central de tráfego' },
      { title: 'Integrações', description: 'Conecte fontes para ampliar a atribuição de resultados.', action: 'Gerenciar integrações', target: 'Integrações' },
    ] },
    'Integrações': { eyebrow: 'ECOSSISTEMA E CONEXÕES', title: 'Gerenciar integrações', description: 'Os canais abaixo ainda não possuem autenticação OAuth/API ativa nesta versão. Para conectar, será necessário configurar credenciais e permissões oficiais de cada plataforma.', items: [
      { title: 'Instagram', description: 'Conexão oficial via Meta, com permissões compatíveis com conta profissional.', action: 'Configuração pendente', target: 'Integrações' },
      { title: 'Facebook', description: 'Conexão oficial via Meta para páginas e ativos autorizados. O mapeamento de grupos da extensão é independente desta conexão.', action: 'Configuração pendente', target: 'Integrações' },
      { title: 'YouTube', description: 'Conexão via Google OAuth e YouTube Data API.', action: 'Configuração pendente', target: 'Integrações' },
      { title: 'Pinterest', description: 'Conexão via Pinterest API e autorização da conta.', action: 'Configuração pendente', target: 'Integrações' },
      { title: 'TikTok', description: 'Conexão via TikTok for Developers e permissões aprovadas.', action: 'Configuração pendente', target: 'Integrações' },
    ] },
  };
  const data = config[active] ?? { eyebrow: 'MÓDULO OPERACIONAL', title: active, description: 'Organize esta etapa da operação. Os dados serão exibidos quando houver uma fonte conectada e validada.', items: [{ title: 'Campanhas', description: 'Configure campanhas, destinos e links rastreáveis.', action: 'Abrir campanhas', target: 'Campanhas' as Section }, { title: 'Integrações', description: 'Conecte fontes oficiais para habilitar métricas e ações autorizadas.', action: 'Ver integrações', target: 'Integrações' as Section }] };
  return <div className="workspace-section">
    <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/>{data.eyebrow}</div><h1>{data.title}</h1><p>{data.description}</p></div><button className="primary-button" onClick={() => onNavigate(active === 'Integrações' ? 'Visão geral' : 'Campanhas')}><ArrowUpRight size={16}/>{active === 'Integrações' ? 'Voltar ao painel' : 'Planejar campanha'}</button></section>
    <section className="panel section-status"><div className="panel-heading"><div><span className="panel-kicker">STATUS DO MÓDULO</span><h2>{active === 'Integrações' ? 'Conexões pendentes' : 'Área em estruturação'}</h2></div><span className="setup-status">{active === 'Integrações' ? 'NÃO CONECTADO' : 'EM CONFIGURAÇÃO'}</span></div><p>{active === 'Integrações' ? 'Nenhum canal será marcado como conectado até que a autorização real seja concluída e validada.' : 'Os atalhos abaixo levam às áreas operacionais já disponíveis enquanto este módulo recebe seus recursos próprios.'}</p></section>
    <section className="section-card-grid">{data.items.map((item, index) => <article className="panel section-action-card" key={item.title}><span className="step-number">0{index + 1}</span><h2>{item.title}</h2><p>{item.description}</p><button className="panel-link" onClick={() => onNavigate(item.target)}>{item.action} <ArrowUpRight size={15}/></button></article>)}</section>
  </div>;
}

function ProductsPage(props: {
  products: Product[]; loading: boolean; error: string; message: string; formOpen: boolean;
  form: ProductForm; saving: boolean; imageFile: File | null; onImageFileChange: (file: File | null) => void; onNew: () => void; onEdit: (product: Product) => void;
  onDelete: (product: Product) => void; onChange: (form: ProductForm) => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void; onClose: () => void; onRefresh: () => void;
}) {
  const { products, loading, error, message, formOpen, form, saving, imageFile, onImageFileChange, onNew, onEdit, onDelete, onChange, onSave, onClose, onRefresh } = props;
  const currency = (value: number | null, code: string) => value == null ? 'Sem preço' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: code }).format(value);
  const imagePreviewUrl = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : null, [imageFile]);
  useEffect(() => () => { if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl); }, [imagePreviewUrl]);
  return <>
    <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> PRODUCT CENTER</div><h1>Seus produtos, em um só lugar.</h1><p>Cadastre ofertas, organize nichos e prepare seus produtos para campanhas orgânicas.</p></div><button className="primary-button" onClick={onNew}><Plus size={17}/> Novo produto</button></section>
    <section className="setup-banner"><div className="banner-icon"><Package size={21}/></div><div className="banner-copy"><strong>Central de produtos conectada ao workspace</strong><span>Os registros são armazenados no Supabase e separados pelo workspace autenticado.</span></div><span className="setup-status">SUPABASE</span></section>
    {message && <p className="product-feedback success">{message}</p>}
    {error && <p className="product-feedback error">{error}</p>}
    <section className="panel product-panel">
      <div className="panel-heading"><div><span className="panel-kicker">CATÁLOGO</span><h2>Produtos cadastrados <small className="count-pill">{products.length}</small></h2></div><button className="subtle-button" onClick={onRefresh}><RefreshCw size={14}/> Atualizar</button></div>
      {loading ? <div className="product-empty"><RefreshCw className="spin" size={22}/><strong>Carregando produtos…</strong></div> :
        products.length === 0 ? <div className="product-empty"><div className="chart-empty-icon"><Package size={22}/></div><strong>Nenhum produto cadastrado</strong><span>Comece adicionando seu primeiro produto ao catálogo.</span><button className="primary-button" onClick={onNew}><Plus size={16}/> Cadastrar produto</button></div> :
        <div className="product-list">{products.map(product => <article className="product-row" key={product.id}><div className="product-symbol">{product.image_url ? <img src={product.image_url} alt={`Imagem de ${product.name}`} /> : <Package size={20}/>}</div><div className="product-main"><strong>{product.name}</strong><span>{product.niche || 'Nicho não definido'} · {product.product_type === 'digital' ? 'Digital' : product.product_type === 'physical' ? 'Físico' : product.product_type === 'service' ? 'Serviço' : 'Afiliado'}</span>{product.description && <small>{product.description}</small>}</div><div className="product-price">{product.promo_price != null ? <><strong>{currency(product.promo_price, product.currency)}</strong><small style={{display:'block',textDecoration:'line-through',opacity:.65}}>{currency(product.price, product.currency)}</small></> : currency(product.price, product.currency)}</div><span className={`product-status ${product.status}`}>{product.status === 'active' ? 'Ativo' : product.status === 'archived' ? 'Arquivado' : 'Rascunho'}</span><div className="product-actions"><button className="icon-button" title="Editar" onClick={() => onEdit(product)}><Pencil size={15}/></button><button className="icon-button danger-button" title="Excluir" onClick={() => onDelete(product)}><Trash2 size={15}/></button></div></article>)}</div>}
    </section>
    {formOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="modal-heading"><div><span className="panel-kicker">PRODUCT CENTER</span><h2 id="product-modal-title">{props.form.name && products.some(p => p.name === props.form.name) ? 'Editar produto' : 'Novo produto'}</h2></div><button className="icon-button" onClick={onClose}><X/></button></div>
      <form className="product-form" onSubmit={onSave}>
        <label>Nome do produto *<input required maxLength={180} value={form.name} onChange={e => onChange({...form,name:e.target.value})} placeholder="Ex.: Curso de Inglês Completo"/></label>
        <div className="form-two"><label>Tipo<select value={form.product_type} onChange={e => onChange({...form,product_type:e.target.value as ProductForm['product_type']})}><option value="digital">Digital</option><option value="physical">Físico</option><option value="service">Serviço</option><option value="affiliate">Afiliado</option></select></label><label>Status<select value={form.status} onChange={e => onChange({...form,status:e.target.value as ProductForm['status']})}><option value="draft">Rascunho</option><option value="active">Ativo</option><option value="archived">Arquivado</option></select></label></div>
        <label>Nicho<input maxLength={120} value={form.niche} onChange={e => onChange({...form,niche:e.target.value})} placeholder="Ex.: Educação, saúde, culinária"/></label>
        <label>Descrição<textarea rows={3} maxLength={3000} value={form.description} onChange={e => onChange({...form,description:e.target.value})} placeholder="Descreva a oferta e seus diferenciais"/></label>
        <label>Imagem do produto<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => onImageFileChange(e.target.files?.[0] ?? null)}/><small>Upload JPG, PNG ou WebP · máximo 5 MB. A imagem será armazenada no Supabase Storage.</small></label>
        <div className="form-two"><label>Preço<input inputMode="decimal" value={form.price} onChange={e => onChange({...form,price:e.target.value})} placeholder="0,00"/></label><label>Moeda<select value={form.currency} onChange={e => onChange({...form,currency:e.target.value})}><option value="BRL">BRL — Real</option><option value="USD">USD — Dólar</option><option value="EUR">EUR — Euro</option></select></label></div>
        <label>Preço promocional<input inputMode="decimal" value={form.promo_price} onChange={e => onChange({...form,promo_price:e.target.value})} placeholder="Opcional — 0,00"/></label>
        <label>Público-alvo<textarea rows={2} maxLength={1200} value={form.target_audience} onChange={e => onChange({...form,target_audience:e.target.value})} placeholder="Para quem é este produto?"/></label>
        <label>Principais benefícios<textarea rows={3} maxLength={2000} value={form.benefits} onChange={e => onChange({...form,benefits:e.target.value})} placeholder="Liste os resultados e benefícios reais da oferta"/></label>
        <label>Bônus incluídos<textarea rows={2} maxLength={1200} value={form.bonuses} onChange={e => onChange({...form,bonuses:e.target.value})} placeholder="Descreva os bônus, se houver"/></label>
        <label>Garantia e condições<textarea rows={2} maxLength={1000} value={form.guarantee} onChange={e => onChange({...form,guarantee:e.target.value})} placeholder="Informe a garantia e condições verdadeiras da oferta"/></label>
        <label>Link de checkout<input type="url" value={form.checkout_url} onChange={e => onChange({...form,checkout_url:e.target.value})} placeholder="https://…"/></label>
        {imagePreviewUrl && <div className="product-image-preview"><img src={imagePreviewUrl} alt="Prévia da imagem selecionada"/></div>}
        {!imageFile && form.image_url && <div className="product-image-preview"><img src={form.image_url} alt="Imagem atual do produto"/></div>}
        {message && <p className="product-feedback error">{message}</p>}
        <div className="modal-actions"><button type="button" className="subtle-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Salvando…' : 'Salvar produto'}</button></div>
      </form></section></div>}
  </>;
}
function Brand() { return <div className="brand"><span className="brand-mark"><Command size={19}/></span><span>AUTO<span>VIRAL</span><small>AI</small></span></div>; }
export default App;
