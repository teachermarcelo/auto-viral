# AutoViral AI — Robot Assistido para Chrome

Extensão complementar para o AutoViral AI. Esta primeira versão é um assistente local do navegador, não um robô de publicação automática.

## Instalação de teste
1. Baixe/clonar o repositório e abra `chrome://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta `extension`.
4. Entre no Facebook normalmente na mesma janela do Chrome.
5. Abra a extensão, informe a URL do grupo e cole o texto da campanha. Clique em **Salvar tarefa e abrir grupo**.
6. No grupo, use o painel AutoViral para copiar o texto. Revise as regras e faça manualmente qualquer pedido de entrada ou publicação.

## Captura de oportunidades
Use **Capturar página atual como oportunidade** para guardar URL, título e texto selecionado. Depois clique em **Exportar capturas para AutoViral** e importe o arquivo JSON em **Grupos e oportunidades → Importar JSON da extensão**.

## Limites desta versão
- Não lê senha, cookies, tokens ou mensagens privadas.
- Não coleta membros, perfis, contatos ou dados pessoais.
- Não solicita entrada automaticamente nem tenta contornar aprovação de administradores.
- Não publica, comenta ou envia mensagens automaticamente.
- Não contorna limites, verificações ou controles do Facebook.
- A tarefa fica armazenada localmente no Chrome; ainda não há sincronização direta com a fila do Supabase.

A extensão usa Manifest V3 e permissões locais mínimas para armazenamento, abas e captura iniciada pelo usuário.
