# Auditoria de segurança — AutoViral AI

**Data da verificação:** 2026-11-14 UTC  
**Repositório:** `teachermarcelo/auto-viral`  
**Branch:** `feat/platform-migration-chrome-extension`  
**Supabase:** projeto `nuyzvpkvawixidotuuio` (compartilhado com outros módulos)

## Resumo executivo

A varredura identificou uma exposição potencial de metadados de aulas pagas por uma view pública com comportamento `SECURITY DEFINER`. A view foi corrigida no Supabase e testada como `anon`: 9 linhas públicas retornadas e **0 linhas com `is_free = false`**. O alerta correspondente desapareceu do Security Advisor.

Também foram encontrados alertas de configuração e objetos legados. Não foram aplicadas políticas genéricas nem alterações destrutivas em tabelas compartilhadas.

## Achados e tratamento

| Severidade | Achado | Estado |
|---|---|---|
| Alta | `public.curriculum_catalog` era uma view SECURITY DEFINER e filtrava apenas `status = 'published'`, enquanto a policy da tabela base restringe usuários anônimos a aulas gratuitas publicadas. A view tinha SELECT concedido a `anon` e `authenticated`. | **Corrigido e verificado**: `security_invoker = true`; consulta sob role `anon` retornou 9 linhas, 0 pagas. |
| Média | Supabase Auth com proteção contra senhas vazadas desabilitada. | **Pendente de configuração no Dashboard**: habilitar em Authentication → Settings → Password Security → Leaked Password Protection. |
| Informativa | 12 tabelas têm RLS habilitado sem policies. Inclui tabelas de tokens/estados/conexões internas do AutoViral e tabelas legadas de `fluent_immersion`. | **Fail-closed**: sem policy, o acesso via Data API é negado. Não criar policies amplas; manter acesso de backend privilegiado e revisar cada caso individualmente. |
| Aviso | `public.av_create_workspace` e `public.av_set_kiwify_webhook_token` são SECURITY DEFINER e executáveis por authenticated. | **Mantidos intencionalmente**: ambas verificam usuário autenticado; a função de token exige papel owner/admin no workspace. `av_verify_kiwify_webhook` está restrita a service_role. |
| Aviso | Extensão `pg_net` instalada no schema `public`. | **Pendente de avaliação**: verificar dependências antes de mover; não alterado. |
| Performance | Advisors apontam índices duplicados/não usados e policies permissivas múltiplas em objetos legados. | **Não destrutivo**: não remover índices nem alterar policies sem análise de dependências e teste de regressão. |

## Validações executadas

- Inventário de 47 tabelas públicas e detalhes das tabelas `av_*`.
- RLS habilitado nas tabelas operacionais AutoViral.
- Revisão das policies `av_*`: políticas por workspace usam helpers privados de membership/admin e role authenticated.
- Revisão das funções SECURITY DEFINER de criação de workspace, configuração de webhook e validação HMAC.
- Revisão do webhook Kiwify: valida assinatura HMAC, associa o workspace pela assinatura e faz upsert por identificador de pedido.
- Revisão das funções Edge de clique, webhook Kiwify e início/retorno OAuth Meta. As rotas sem verificação JWT automática devem manter validação própria de assinatura, JWT ou estado OAuth.
- Build web no commit `a696445999a28b1baf2bd523e744a837163dc122`: GitHub Actions CI **success** (npm install + npm run build). Alterações posteriores exigem novo CI.
- Extensão canônica identificada em `chrome-extension/`; a pasta `extension/` era uma implementação duplicada e não era empacotada pelo workflow oficial.

## Extensão Chrome — hardening e escopo

- A extensão canônica é Manifest V3 em `chrome-extension/`.
- O worker valida origem da mensagem, URL HTTPS do grupo e tamanho do texto antes de abrir uma tarefa.
- A bridge da aplicação responde apenas a mensagens originadas na mesma página e no domínio AutoViral.
- Tokens de sessão devem ficar em `chrome.storage.session`, não em armazenamento local persistente.
- Captura de grupos é limitada ao conteúdo público já exibido na página carregada.
- Não coleta membros, perfis, mensagens privadas, cookies ou senhas.
- Não automatiza clique em Participar, não contorna aprovação e não publica sem ação do operador.

## Ações manuais ainda necessárias

1. Habilitar Leaked Password Protection no Supabase Auth.
2. Conferir a configuração de Auth/MFA e as URLs de redirecionamento autorizadas.
3. Validar a extensão em Chrome real com uma única tarefa de teste e confirmar o comportamento de sincronização.
4. Reexecutar GitHub Actions CI e Package AutoViral Chrome Extension após as alterações deste relatório.
5. Revisar o aviso de `pg_net` e os índices/policies legados em uma janela separada.

## Limites desta auditoria

A inspeção foi de leitura e testes controlados no branch e no projeto Supabase indicado. Não foi feito pentest externo, brute force, teste de invasão em contas de terceiros, análise de tráfego de produção completa, nem teste de todas as Edge Functions e integrações com contas reais. O relatório não certifica o sistema como invulnerável.
