# AutoViral Data Core — plano de implementação

Status: Fase 1 iniciada — Firebase Authentication, workspace Firestore e CRUD do Product Center conectados; migração dos demais módulos pendente.
Branch: `feat/autoviral-data-core`
Base: `feat/platform-migration-chrome-extension`

## Objetivo e arquitetura escolhida

Construir o AutoViral Data Core sob controle do proprietário, priorizando custo zero e simplicidade operacional. A decisão atual é usar Firebase Authentication + Cloud Firestore (banco padrão) como núcleo inicial. O Supabase permanece intacto e em paralelo até a migração de cada módulo ser validada. Cloudflare Workers/R2 poderão complementar endpoints e arquivos quando necessário, sem tornar o projeto dependente de um serviço pago.

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

## Arquitetura-alvo atual

1. **Firebase Authentication:** login e cadastro por e-mail/senha. Cada UID autentica o proprietário.
2. **Cloud Firestore (banco padrão):** documentos isolados em `workspaces/{workspaceId}` e subcoleções por módulo. O primeiro workspace usa o UID como ID, com `ownerUid` validado pelas regras.
3. **Regras Firestore:** todas as operações exigem autenticação e vínculo ao workspace. Nunca publicar regras abertas.
4. **Arquivos:** Firebase Storage está desativado no fluxo atual para respeitar a preferência por Spark/custo zero; o Cloud Storage for Firebase exige Blaze desde 03/02/2026. Usar URLs de imagem por enquanto e avaliar Cloudflare R2 como armazenamento separado sem ativar faturamento Firebase.
5. **Auditoria:** subcoleção `auditEvents`, health checks, tratamento de limites e exportação.
6. **Frontend:** migrar cada módulo para funções de dados Firebase/contratos isolados, sem substituir todas as chamadas em uma única alteração.

### Limites gratuitos e custos

- O Cloud Firestore no Spark inclui até 1 GiB armazenado, 50.000 leituras/dia, 20.000 gravações/dia, 20.000 exclusões/dia e 10 GiB/mês de transferência de saída. As cotas são por projeto e podem bloquear o serviço ao serem excedidas.
- Firebase Authentication para login por e-mail/senha está disponível sem custo nas condições do plano Spark.
- Cloud Storage for Firebase exige o plano Blaze para provisionar ou manter acesso a buckets padrão; por isso, o upload direto foi desativado no Product Center enquanto o projeto permanecer Spark.
- Nenhuma etapa deve ativar cobrança ou alterar o plano Firebase sem autorização expressa do proprietário.

## Plano não destrutivo

### Fase 0 — inventário (concluída)
- Confirmar branch de aplicação, stack, dependências, variáveis e chamadas diretas.
- Catalogar migrations, funções server-side e armazenamento.
- Não acessar nem alterar tabelas compartilhadas de outros produtos.

### Fase 1 — fundação Firebase (em andamento)
- Inicializar Firebase Auth e Firestore no frontend.
- Autenticar por e-mail/senha e provisionar workspace/membro proprietário.
- Migrar CRUD de Produtos para Firestore, sem upload de binários no Spark.
- Publicar e testar regras Firestore antes de armazenar dados reais.
- Não alterar a branch `main` nem o workflow de produção sem validação.

### Fase 2 — migração dos módulos
- Migrar Campanhas, comunidades, públicos, links, posts, leads, vendas, analytics e agente de distribuição em sequência.
- Para cada módulo: mapear campos, implementar CRUD, validar regras, testar leitura/gravação e comparar contagens.
- Substituir Edge Functions por Workers/endpoints próprios apenas após inventário e testes individuais.

### Fase 3 — compatibilidade e importação
- Implementar adaptador de leitura legado para exportações do Supabase.
- Manter Supabase como fonte oficial até reconciliação.
- Migrar por lotes idempotentes, com contagem e hash/checksum.
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

- O projeto Firebase `autoviral-data-core` e o app Web foram criados pelo proprietário.
- O Firebase Auth está habilitado para e-mail/senha e Google; a interface atual usa e-mail/senha.
- O Firestore está criado; as regras do repositório ainda precisam ser publicadas manualmente no console.
- A cota/egress do Supabase está bloqueada segundo o usuário. A exportação real pode precisar aguardar o restabelecimento do acesso ou usar backup existente.
- A publicação atual está em modo demonstração e sem autenticação no frontend. Antes de conectar dados reais, é obrigatório restabelecer autenticação/controle de acesso no backend.
- O plano gratuito não é ilimitado nem garante SLA. O projeto deve incluir alertas e exportações periódicas.

## Referências oficiais consultadas

- Firebase pricing: https://firebase.google.com/pricing/
- Firestore quotas: https://firebase.google.com/docs/firestore/quotas
- Cloud Storage billing requirements: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
