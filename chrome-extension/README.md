# AutoViral AI — Mapeador de Grupos (0.4.1)

Extensão Chrome Manifest V3 que identifica URLs de grupos públicos exibidos nos resultados carregados pelo próprio usuário e sincroniza os registros com `av_communities` no workspace autenticado.

## Instalação / atualização

1. Baixe o artefato ZIP **autoviral-chrome-extension** na execução mais recente do workflow **Package AutoViral Chrome Extension** do repositório.
2. Extraia o ZIP em uma pasta local permanente.
3. Abra `chrome://extensions` no Chrome.
4. Ative **Modo do desenvolvedor**.
5. Se já houver uma versão antiga, remova-a. Clique em **Carregar sem compactação** e selecione a pasta extraída que contém `manifest.json`.
6. Fixe o ícone AutoViral na barra do Chrome.

## Primeiro uso

1. Abra o AutoViral em `https://teachermarcelo.github.io/auto-viral/` e entre na conta.
2. Mantenha a extensão instalada. O arquivo `platform-bridge.js` identifica a sessão ativa do Supabase no domínio da plataforma e a compartilha diretamente com o service worker da extensão; não digite novamente a senha no popup.
3. Abra o Facebook e pesquise grupos públicos relacionados ao seu nicho.
4. Role os resultados normalmente para que a página carregue os links.
5. Abra o popup para acompanhar a fila, pausar/retomar ou solicitar nova leitura.
6. Os grupos capturados são sincronizados automaticamente para o workspace autenticado. Consulte **Grupos e oportunidades** na plataforma.

## Como funciona

- Captura somente links de grupos públicos que já aparecem no DOM visível da página carregada.
- Deduplicação local por URL; fila limitada aos 1.500 registros mais recentes.
- A sincronização usa Supabase Auth, chave publicável e JWT do usuário; a extensão não contém chave service-role.
- Os registros são gravados em `av_communities`, com status inicial `to_review`.
- A sessão é renovada pelo Supabase quando necessário. Desconectar a extensão remove a sessão local.
- A captura depende de o Chrome, a sessão e a aba estarem ativos; não executa quando o navegador está fechado.

## Limites e conformidade

- Não coleta membros, perfis, mensagens ou dados de grupos privados.
- Não entra em grupos, não curte, comenta, publica ou envia mensagens.
- Não contorna controles, bloqueios, CAPTCHA ou limites do Facebook.
- O mapeamento depende dos resultados que o próprio Facebook disponibiliza e carrega na página; não há garantia de capturar resultados que não foram exibidos.
- Revise as regras de cada grupo antes de qualquer divulgação. A extensão não realiza disparos em massa.

## Validação automatizada

O workflow valida JSON do manifesto, existência de todos os arquivos referenciados, sintaxe JavaScript e criação do ZIP. Isso valida o pacote, mas não substitui um teste manual com a conta e o Chrome do usuário.
