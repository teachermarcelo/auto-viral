# Auditoria inicial — AutoViral AI

Data: 2026-11-12
Repositório: teachermarcelo/auto-viral
Branch de implementação: feat/phase-1-foundation

## GitHub

- Repositório público, ativo e com permissão de push disponível.
- Branch padrão: main (não protegida).
- Árvore recursiva de main: apenas README.md (12 bytes); sem aplicação, workflows, dependências ou código-fonte.
- Branch de trabalho criada sem alterar main.

## Supabase — inventário da conta conectada

Foram encontrados três projetos:
- fluent-immersion — ACTIVE_HEALTHY, região us-west-2. Contém tabelas vsa_products, vsa_campaigns, vsa_tracking_links, vsa_tracking_events, vsa_leads, vsa_sales, vsa_creatives, autoviral_campaigns e autoviral_tracking_events, além de funções Edge vsa-*.
- Projeto pessoal inativo — a leitura do catálogo de tabelas retornou erro de disponibilidade; não foi possível auditar o schema.
- ingles-para-nacoes — ACTIVE_HEALTHY, região sa-east-1, com muitas tabelas de aplicações distintas. Não é recomendado reutilizá-lo para o AutoViral sem confirmação explícita.

O projeto fluent-immersion é o candidato tecnicamente mais próximo por já conter objetos vsa/autoviral, mas o nome e os demais objetos indicam que é compartilhado com outros produtos. A migração av_workspace_* está preparada no repositório e NÃO foi aplicada ao banco. A conexão de produção precisa de confirmação explícita do destino antes de qualquer alteração remota.

## Segurança identificada no projeto fluent-immersion

O Supabase Security Advisor reportou:
- RLS habilitado sem policies em public.vsa_meta_connections e public.vsa_meta_oauth_states.
- Uma view public.curriculum_catalog com SECURITY DEFINER.
- Proteção contra senhas vazadas desabilitada no Auth.

Esses alertas pertencem ao projeto compartilhado existente e não foram alterados nesta fase. Não se deve simplesmente habilitar RLS nas tabelas OAuth sem criar policies apropriadas, pois isso pode interromper os fluxos legítimos. Revisar também a view e a configuração de senha antes de disponibilizar o sistema a clientes.

## Implementação inicial

- React + TypeScript + Vite.
- Shell responsivo dark UI, navegação modular e dashboard inicial.
- Supabase Auth por e-mail/senha quando as variáveis de ambiente estão configuradas.
- Sem dados fictícios nos indicadores: exibem estado vazio até haver eventos reais.
- .env ignorado pelo Git; .env.example contém apenas placeholders.
- Migração multi-workspace preparada com RLS e memberships, pendente de revisão/aplicação no projeto de destino.

## Limitações e próximos passos

- Ainda não há integração funcional de workspace com banco, nem CRUD de produtos, campanhas ou publicação.
- Ainda não há testes automatizados ou build executado em ambiente de CI.
- Configurar GitHub Actions para validar TypeScript/build.
- Confirmar o Supabase de destino e então aplicar a migração revisada, validar RLS e testar isolamento entre dois usuários.
- Depois ligar dashboard a consultas reais, sem misturar tabelas de outros produtos.
