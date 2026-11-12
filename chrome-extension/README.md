# AutoViral AI — Mapeador de Grupos (0.3.0)

Extensão Chrome Manifest V3 que identifica URLs de grupos do Facebook presentes nos resultados carregados pelo usuário e sincroniza os grupos selecionados diretamente com `av_communities` no workspace autenticado.

## Instalação / atualização

1. Abra `chrome://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Atualizar** na extensão ou remova a versão antiga e use **Carregar sem compactação** apontando para esta pasta.
4. Fixe o ícone AutoViral na barra do Chrome.

## Uso

1. Abra o Facebook e faça uma pesquisa de grupos.
2. Deixe a página aberta e role os resultados normalmente.
3. O content script observa rolagem, alterações do DOM e navegação interna; links novos entram na fila local automaticamente.
4. Abra o popup para acompanhar os contadores, pausar/retomar ou solicitar uma leitura.
5. Conecte usando o mesmo e-mail e senha da conta AutoViral.
6. Clique em **Enviar grupos para a plataforma**. A extensão descobre o workspace da conta e grava os grupos em `av_communities`, respeitando RLS.
7. Volte à plataforma e atualize **Grupos e oportunidades**.

## Comportamento e limites

- Captura somente URLs de grupos presentes no DOM e visíveis na página carregada.
- Continua enquanto o Chrome e a aba do Facebook estiverem abertos; após atualizar a página, o content script é reinjetado e a fila local permanece.
- Deduplicação local por URL; fila limitada aos 1.500 registros mais recentes.
- O envio ao banco só ocorre após clique explícito do usuário.
- Usa Supabase Auth + chave publicável + JWT; não contém service-role key. RLS limita gravações ao workspace associado ao usuário.
- A senha não é persistida; tokens de sessão são armazenados localmente para renovação. Desconectar remove a sessão local.
- Não lê membros, perfis, mensagens, grupos privados ou dados não carregados/visíveis; não entra em grupos, não curte, comenta, publica ou envia mensagens.
- Não funciona com Chrome fechado, computador desligado ou sessão encerrada.
- Facebook pode alterar a estrutura da página, limitar resultados ou exigir ações adicionais. Não há garantia de mapear grupos que não tenham sido carregados na página.

## Permissões

- `activeTab`, `scripting`, `storage`: leitura da aba ativa, solicitação de varredura e fila local.
- `host_permissions`: páginas Facebook e endpoint Supabase para autenticação e sincronização.

## Segurança e validação

A extensão grava somente registros em `av_communities` e depende das políticas RLS existentes. Teste com uma conta real do workspace antes de distribuição. A captura é local até o usuário clicar no botão de envio.