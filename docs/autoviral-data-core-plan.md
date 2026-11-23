# AutoViral Data Core — plano de implementação

Status: Fase 0 concluída (inventário do repositório); nenhuma migração de dados executada.
Branch: `feat/autoviral-data-core`
Base: `feat/platform-migration-chrome-extension`

## Objetivo

Construir uma camada de dados controlada pelo projeto AutoViral, sem dependência obrigatória do SDK, Auth, Storage ou Edge Functions do Supabase. O primeiro destino de banco recomendado é PostgreSQL gerenciado no plano gratuito do Neon; a API será código próprio em Cloudflare Workers. O projeto e as credenciais ficam sob controle do proprietário. Isso é um banco/projeto próprio em infraestrutura gerenciada, não um servidor físico próprio.

## Inventário confirmado

- Aplicação: React 19 + TypeScript + Vite.
- Hospedagem atual do frontend: GitHub Pages; é estática e não executa Node/PostgreSQL no servidor.
- Cliente de dados: `@supabase/supabase-js` em `src/lib/supabase.ts`.
- Configuração do frontend: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- A aplicação importa diretamente o cliente Supabase em `App.tsx`, `OperationalPages.tsx`, `GroupCommandCenter.tsx`, `GrowthToolsPage.tsx` e `DistributionAgentPage.tsx`.
- Há chamadas diretas a tabelas, RPC, Auth, Storage e Edge Functions; portanto, trocar somente as variáveis de ambiente não é uma migração.
- As migrations existentes definem entidades `av_*` para perfis, workspaces, membros, produtos, campanhas, integrações, eventos de atividade, posts, comunidades, oportunidades, links/eventos de rastreamento, leads, vendas, segredos de webhook, assets criativos, alvos por cidade, relatórios, conteúdo social, campanhas de e-mail, públicos, execuções e configurações/eventos do agente de distribuição.
- Existem Edge Functions Supabase para Meta OAuth/Ads, publicação de Stories, agendamento, Kiwify, captação de leads, cliques e ferramentas Gemini. Cada uma precisa de substituta API/Worker e testes próprios.
- A branch padrão `main` contém apenas README; o código ativo e o workflow do Pages estão em `feat/platform-migration-chrome-extension`. O trabalho novo é isolado nesta branch.

## Arquitetura-alvo recomendada

1. **PostgreSQL (Neon Free):** dados relacionais e migrations SQL versionadas no repositório.
2. **API própria (Cloudflare Workers):** única entrada do frontend para operações privadas; valida sessão, autorização por workspace, validação de payloads e limites.
3. **Autenticação:** camada independente do banco, com sessões seguras e papéis por workspace. A implementação deve ser escolhida e validada antes de liberar dados reais; nunca colocar segredo de servidor no bundle Vite.
4. **Arquivos:** manter URLs/metadata no PostgreSQL; escolher storage separado após medir volume e validar limites gratuitos. Não misturar binários com linhas do banco.
5. **Observabilidade:** logs de auditoria, health check, métricas de erros e exportação/backup.
6. **Frontend:** introduzir um contrato `DataProvider` e adaptadores. Migrar módulo a módulo, sem trocar todas as chamadas de uma vez.

### Por que Neon + Workers

- Neon mantém PostgreSQL, reduzindo a distância em relação ao schema SQL atual.
- A documentação consultada do Neon informa plano Free com 100 CU-hours por projeto/mês, 1 GB de armazenamento por projeto e 5 GB de transferência pública por mês; o compute suspende após 5 minutos de inatividade. Limites podem suspender consultas quando esgotados.
- Cloudflare Workers Free informa 100.000 requests/dia e 10 ms de CPU por invocação. É adequado para protótipo/API leve, não para prometer processamento pesado ou automações contínuas ilimitadas.
- Cloudflare D1 também tem plano gratuito, mas é SQLite e impõe limites diários/por banco; não é a primeira escolha porque o projeto atual já usa PostgreSQL e funções SQL específicas.

## Plano não destrutivo

### Fase 0 — inventário (concluída)
- Confirmar branch de aplicação, stack, dependências, variáveis e chamadas diretas.
- Catalogar migrations, funções server-side e armazenamento.
- Não acessar nem alterar tabelas compartilhadas de outros produtos.

### Fase 1 — fundação local (próxima)
- Criar `data-core/` com schema PostgreSQL portátil, migrations numeradas, contrato API e ambiente Docker Compose para desenvolvimento local.
- Adicionar testes de schema e de autorização por workspace.
- Não mudar ainda o provider do frontend nem o workflow de produção.

### Fase 2 — serviço remoto gratuito
- O proprietário cria/autoriza a conta Neon e Cloudflare.
- Criar projeto PostgreSQL e Worker de staging.
- Configurar secrets apenas no painel do Worker/GitHub Actions; nunca em `VITE_*`.
- Executar migrations em banco vazio e validar saúde, autenticação, isolamento e backups.

### Fase 3 — compatibilidade
- Implementar adaptador Supabase legado e adaptador AutoViral API.
- Começar por leitura/CRUD de Produtos em ambiente de staging.
- Comparar resultados e erros; manter Supabase como fonte oficial até reconciliação.
- Migrar campanhas, comunidades, públicos, links, posts, leads, vendas e métricas por lotes idempotentes, com contagem e hash/checksum.
- Preservar IDs, timestamps, relacionamentos e registros de origem.

### Fase 4 — funções e arquivos
- Substituir cada Edge Function por endpoint/Worker equivalente.
- Mover OAuth tokens e segredos para secret storage do servidor.
- Migrar arquivos com verificação de tamanho, MIME, hash e URL.
- Testar webhooks com assinatura, idempotência e replay protection.

### Fase 5 — troca controlada
- Fazer backup/exportação antes da cópia final.
- Pausar gravações durante a janela de corte.
- Fazer importação final e comparar contagens/checksums.
- Alterar o frontend para o novo provider em uma release controlada.
- Manter procedimento de rollback; não apagar o Supabase antigo até confirmação expressa e período de observação.

## Critérios de segurança e aceite

- Sem credenciais privadas no frontend, Git ou extensão.
- Todas as operações privadas autenticam usuário e autorizam `workspace_id` no servidor.
- Teste negativo: usuário A não lê nem altera dados do workspace B.
- Webhooks verificam assinatura e são idempotentes.
- Build e testes passam antes de cada deploy.
- Nenhum número fictício em métricas; sem integração conectada, mostrar estado "não conectado".
- Não ativar distribuição automática durante a migração; exigir aprovação humana e logs.
- Exceder quota gratuita deve falhar de forma explícita e preservar dados, não apagar nem trocar silenciosamente o banco.

## Bloqueios e decisões

- A conta Neon/Cloudflare ainda precisa ser criada/conectada pelo proprietário; este repositório não concede acesso a contas externas.
- A cota/egress do Supabase está bloqueada segundo o usuário. A exportação real de dados pode precisar aguardar o restabelecimento do acesso ou usar um backup previamente existente.
- A publicação atual está em modo demonstração e sem autenticação no frontend. Antes de conectar dados reais, é obrigatório restabelecer autenticação/controle de acesso no backend.
- O plano gratuito não é ilimitado nem garante SLA. O projeto deve incluir alertas e exportações periódicas.

## Referências oficiais consultadas

- Neon Free plan: https://neon.com/docs/introduction/plans
- Neon quotas: https://neon.com/docs/introduction/usage
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/
