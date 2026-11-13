# AutoViral AI — Mapeador de Grupos (0.4.3)

Extensão Chrome Manifest V3 para mapear links de grupos públicos que aparecem nos resultados carregados pelo próprio usuário no Facebook e sincronizá-los com a tabela `av_communities` do workspace conectado.

## Instalação / atualização

1. Baixe o ZIP `autoviral-chrome-extension` na execução mais recente do workflow **Package AutoViral Chrome Extension** do repositório.
2. Extraia o ZIP em uma pasta local.
3. Abra `chrome://extensions`, ative **Modo do desenvolvedor**, remova a versão anterior e clique em **Carregar sem compactação**.
4. Selecione a pasta extraída que contém `manifest.json`.
5. Entre no AutoViral AI em `https://teachermarcelo.github.io/auto-viral/` na mesma instalação do Chrome.
6. Abra o Facebook e pesquise grupos públicos relacionados ao seu produto. Role os resultados para carregar mais cartões.
7. Abra o popup da extensão: veja quantos grupos foram encontrados e clique em **Enviar grupos para a plataforma**. A sincronização automática também permanece ativa.

## Pesquisas sugeridas para os produtos educacionais

Faça uma pesquisa por vez no Facebook e role os resultados:
- grupos de professores alfabetização
- atividades de alfabetização educação infantil
- professores educação infantil atividades
- atividades pedagógicas para imprimir
- coordenação motora educação infantil
- psicopedagogia professores
- recursos pedagógicos para professores
- atividades para anos iniciais

A extensão só captura links que o Facebook já mostrou na página carregada. Pesquise outros termos para ampliar a cobertura; não há promessa de capturar todos os grupos existentes.

## O que é enviado

Cada registro inclui nome estimado a partir do cartão visível, URL do grupo, termo de pesquisa quando disponível, URL da página de origem, data da captura e trecho público do cartão para ajudar a revisar o contexto. A extensão não coleta listas de membros, perfis individuais, mensagens ou conteúdo privado.

Os grupos são salvos no AutoViral em **Grupos e oportunidades**, com status inicial **Revisar regras** (`to_review`). Antes de divulgar, abra cada grupo, leia as regras e só marque como aprovado quando a divulgação for permitida.

## Segurança e limites

- A extensão usa a sessão autenticada do Supabase do próprio AutoViral; não pede sua senha no popup.
- Não contém service-role key.
- Não entra em grupos, não publica, não curte, não comenta e não envia mensagens.
- Não contorna CAPTCHA, bloqueios ou limites da plataforma.
- A sincronização depende de o Chrome estar aberto e da sessão válida.
- O mapeamento é de grupos públicos visíveis na página; não há acesso a resultados não carregados.

## Validação

O workflow do repositório verifica o build do frontend e empacota a extensão. O teste final de captura/sincronização exige executar o Chrome conectado à sua conta do Facebook e ao workspace AutoViral.
