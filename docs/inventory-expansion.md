# AutoViral AI — expansão a partir do inventário funcional

Este documento traduz o inventário recebido para a arquitetura atual do AutoViral. A base operacional continua sendo React + TypeScript + Vite no frontend e Supabase (Postgres, Auth, Storage e Edge Functions) no backend. Não migrar para Firebase/Firestore nem criar servidor Express duplicado: a plataforma já usa Supabase e GitHub Pages, e Edge Functions atendem os webhooks/APIs sem manter um servidor Node permanentemente ativo.

## Entregue nesta etapa
- Novas tabelas isoladas por workspace e protegidas por RLS: `av_creative_assets`, `av_city_targets`, `av_research_reports`, `av_email_campaigns`, `av_social_content`.
- Nova página `GrowthToolsPage` integrada à navegação: Estúdio Criativo, Inteligência de Mercado, Radar de Audiência, Central de Tráfego, Automações (registro de rotinas), Funis e Páginas (rascunhos de pré-atendimento), Comentador (biblioteca de respostas), YouTube, Pinterest, Email Marketing (rascunhos), WhatsApp X1 (roteiros individuais), Robô por Cidades, Relatórios IA e Importar comunidades.
- Importação de URLs de grupos Facebook para revisão, sem entrar no grupo nem publicar.
- API autenticada `av-gemini-tools` para rascunhos criativos, pesquisa e relatórios. Requer secret `GEMINI_API_KEY`; sem a chave a função responde indisponível e não simula geração.
- Integração existente de Kiwify, rastreamento e Stories agendados preservada.
- Build TypeScript/Vite aprovado no GitHub Actions para o commit bce9515cc8b1dda01861d7bd93bc3bb01d5d3d9a. Commits posteriores de expansão estão em validação.

## Mapeamento do inventário para a arquitetura real

| Área do inventário | Implementação/estado |
|---|---|
| Dashboard, métricas, funil, Radar ao Vivo | Analytics atual mostra eventos reais disponíveis; visitantes em tempo real, geolocalização e métricas demográficas dependem de fonte confiável e consentimento. |
| Produtos e campanhas | Já existem no Supabase. |
| Grupos e públicos salvos | Comunidades e públicos atuais; importação adicionada. |
| Robô de disparo em grupos Facebook | Não automatizar postagem em grupos. Usar fila editorial, aprovação humana, link rastreável e publicação manual autorizada. |
| Link curto e pré-atendimento | Links rastreáveis e captura de leads já existem; páginas de pré-atendimento ainda precisam de construtor próprio. |
| Posts e status de postagem | Calendário existente; Stories Instagram com API oficial e agendador, dependente da conexão Meta. Outros canais manuais. |
| YouTube e Pinterest | Workspaces para organizar conteúdo. Publicação, leitura de métricas e comentários exigem OAuth/API oficial e aprovação de escopos. |
| Robô WhatsApp X1 | Roteiros individuais e links wa.me; disparo em massa não habilitado. WhatsApp Business Platform exige opt-in, templates e janela de atendimento. |
| Email/Brevo | Rascunhos são persistidos. Envio e tracking de abertura/clique exigem BREVO_API_KEY, lista consentida e configuração do domínio. |
| Meta Ads | Integração OAuth/Ads Insights ainda depende de app Meta, permissões e revisão. Não exibir anúncios ou gastos simulados. |
| Landing pages | Campanhas e formulários de captura existem; construtor visual completo ainda não implementado. |
| Lead Finder | Não coletar dados pessoais de pessoas sem base legal/consentimento. Usar pesquisa de comunidades públicas e formulários opt-in. |
| Gemini | API implantada; adicionar `GEMINI_API_KEY` nos secrets do Supabase para ativar. |
| Hotmart | Webhook específico não implantado. Requer especificação atual de autenticação/eventos e token da conta. |
| Firebase | Não adotado. Supabase permanece fonte única de verdade para evitar duplicação e conflitos. |

## Secrets externos necessários
- `GEMINI_API_KEY`: habilita geração e pesquisa assistida.
- `BREVO_API_KEY`: habilita envio de campanhas e métricas Brevo após configuração.
- Meta App ID/Secret e autorização de conta profissional: habilitam publicação e insights Meta permitidos.
- Credenciais Google/YouTube e Pinterest: habilitam suas APIs após OAuth.
- Token oficial Kiwify: configurar em Integrações; webhook já implantado.
- Hotmart: validar documentação e credenciais antes de implementar o webhook.

Nunca inserir secrets no frontend, no repositório, no ZIP da extensão ou em capturas de tela.
