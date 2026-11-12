# Mapa de migração — Viral Sales AI → AutoViral AI

Data: 2026-11-12  
Repositórios de referência: `teachermarcelo/viral-sales-ai` e `teachermarcelo/auto-viral`  
Branch desta etapa: `feat/platform-migration-chrome-extension`

## Escopo e evidência

O endereço público `https://robo-trafego.vercel.app/` respondeu apenas com a tela de carregamento na inspeção automatizada. Para não inventar funcionalidades, este mapa usa como evidência o código-fonte público de `viral-sales-ai` (branch `main`), seu README, scripts JavaScript e migrations. O site público e o código do repositório podem estar em versões diferentes; diferenças serão confirmadas em teste visual/manual.

## Inventário funcional encontrado

| Módulo de origem | Evidência no código | Estado comprovado / ressalva | Destino no AutoViral |
|---|---|---|---|
| Growth Command Center | `assets/js/app.js` | Cards de produtos, oportunidades, cliques, receita, gráfico de 7 dias e funil; dados dependem de registros reais | Visão geral / Analytics |
| Produtos | `app.js`, `product-intelligence.js` | CRUD, nicho, preço, custo, margem, checkout, imagem, descrição, público e benefícios | Product Center |
| Campanhas | `app.js` | Cadastro por produto, canal, objetivo, status e orçamento | Campaign Center |
| Rastreamento | `app.js`, `track.html`, `vsa-track-click` | Links rastreáveis, UTMs e eventos de clique; não identifica nominalmente visitantes anônimos | Traffic Command Center |
| Leads | `app.js`, `lead-capture.js` | Cadastro manual, status e consentimento; captura por formulário em página pública | CRM |
| Vendas | `app.js`, migration `vsa_sales` | Livro de vendas manual; integração automática de pagamentos não comprovada | Sales Machine |
| Inteligência de mercado | `app.js` | Gera pesquisas externas e termos/hashtags; não há fonte de volume/estimativa validada | Market Intelligence |
| AI Audience Finder | `app.js`, `audience-finder.js` | Links para pesquisas públicas e salvamento manual de oportunidades; consulta Meta de interesses/localização depende de Edge Function | Audience Radar |
| AI Creative Studio | `app.js`, `vsa-ai-campaign` | Geração de hooks, legendas, CTA e briefing; requer segredo do provedor no servidor | Creative Studio |
| Meta Ads | `meta-connection.js`, `publication-center.js` | Interface chama funções de OAuth/insights/targeting; implementações dessas funções não estão no repositório de origem auditado | Integrations + Ads Intelligence |
| Central de Publicação | `publication-center.js` | Salva rascunhos, canais, mídias e data/hora; não há comprovação de publicação real ou agendamento executado | Publishing Center |
| Captação gratuita | `lead-capture.js`, `captura.html` | Cadastro de iscas digitais e link público; envio automático por e-mail/WhatsApp é explicitamente futuro | Funnels & Lead Magnets |
| Configurações e backup | `app.js` | Configuração Supabase no cliente e exportação JSON; chave publishable é pública, nunca usar service-role no browser | Settings / Data Export |

## Regras de migração

1. O AutoViral é a plataforma principal. Não manter dois painéis concorrentes.
2. Preservar a arquitetura React + TypeScript + Vite já iniciada em `auto-viral`.
3. Persistência nova exclusivamente em tabelas `av_*`, com `workspace_id`, RLS e isolamento por workspace.
4. Não renomear, apagar, alterar ou sobrescrever tabelas `vsa_*`, `tic_*` ou tabelas de outros sistemas no Supabase compartilhado.
5. Dados antigos só poderão ser copiados para tabelas `av_*` por um importador controlado, com prévia, contagem, deduplicação e confirmação; nunca apagar a origem automaticamente.
6. Não declarar uma integração ativa sem autenticação, chamada real, tratamento de erro, leitura de retorno e teste.
7. Métricas sem fonte conectada devem mostrar estado vazio/“aguardando conexão”, nunca números inventados.
8. Segredos OAuth e chaves privadas ficam em Edge Functions/servidor. O frontend e a extensão nunca recebem service-role nem tokens de longa duração.
9. Publicação social, Meta Ads, pagamentos, e-mail e WhatsApp dependem de APIs oficiais, permissões e credenciais válidas.

## Extensão Chrome — escopo da primeira versão

A pasta `chrome-extension/` contém uma extensão Manifest V3 que, após clique explícito do usuário:
- lê o título, URL, descrição e texto selecionado da aba ativa;
- permite classificar o sinal (dor, pergunta, recomendação, intenção de compra ou comparação);
- permite adicionar observação;
- guarda capturas localmente no Chrome;
- permite copiar, excluir, exportar JSON e abrir o AutoViral.

Permissões limitadas a `activeTab`, `scripting` e `storage`. Não há coleta em segundo plano, varredura de abas, scraping em massa, disparo de mensagens ou interação automática com redes sociais. A integração autenticada para importar diretamente no workspace será concluída na fase de conexão entre extensão e módulo Radar de Audiência.

## Plano de execução

### Fase 1 — Fundação (em andamento)
- Autenticação, workspace, isolamento RLS e CRUD inicial de produtos.
- GitHub Actions para build e GitHub Pages.
- Não alterar `main` nem fazer merge sem autorização.

### Fase 2 — Migração do núcleo comercial
- Product Center completo.
- Campanhas, links rastreáveis, eventos, UTMs e dashboard.
- CRM, leads com consentimento e livro de vendas.
- Importador não destrutivo dos dados legados `vsa_*`.

### Fase 3 — Inteligência e criação
- Market Intelligence com fontes identificadas.
- Audience Radar e pipeline de oportunidades.
- Creative Studio conectado a Edge Functions.
- Histórico, revisão humana e exportação.

### Fase 4 — Distribuição e aquisição
- Central de Publicação: rascunho, aprovação, calendário e execução real via API oficial.
- Meta OAuth, insights e targeting apenas após validar as Edge Functions e permissões.
- Lead magnets, páginas de captura e integrações de entrega.

### Fase 5 — Chrome e automações
- Importação autenticada das capturas da extensão para o Radar.
- Deduplicação, classificação e associação a produto/campanha.
- Automações com aprovação humana, logs, limites e opção de desligar.

### Fase 6 — Qualidade e lançamento
- Testes de isolamento entre workspaces, segurança, acessibilidade e responsividade.
- Testes ponta a ponta de fluxos reais e monitoramento.
- Publicação no GitHub Pages; extensão distribuída inicialmente como pacote instalável (Load unpacked), com publicação na Chrome Web Store somente após validação e preparação da conta.

## Critérios de aceite

- Build e CI aprovados.
- Nenhuma alteração na branch `main` sem autorização.
- Nenhum segredo privado no bundle web ou extensão.
- Todas as operações de dados respeitam `workspace_id` e RLS.
- Cada integração apresenta claramente conectada, não configurada ou erro.
- Nenhum envio em massa ou automação de contato não solicitada.
