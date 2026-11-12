# AutoViral AI — Chrome Extension

Extensão Manifest V3 para capturar manualmente páginas e trechos públicos que o usuário deseja revisar como possíveis oportunidades.

## Instalação local

1. Abra `chrome://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `chrome-extension` deste repositório.
5. Fixe o ícone do AutoViral na barra do Chrome.

## Como usar

### Mapear vários grupos do Facebook

1. Abra a busca do Facebook e pesquise o tema desejado.
2. Aguarde os resultados aparecerem e role a página para carregar mais cartões.
3. Clique no ícone da extensão e em **Mapear grupos visíveis nesta página**.
4. Confira os links encontrados, desmarque o que não deseja guardar ou use selecionar todos/limpar seleção.
5. Clique em **Salvar grupos selecionados**. Links repetidos são ignorados.
6. Exporte o JSON e importe-o na área **Grupos e oportunidades** do AutoViral.

O mapeador lê somente links de grupos que já estejam presentes e visíveis no DOM da página aberta. Ele não percorre membros, perfis, listas privadas, não entra automaticamente em grupos e não faz coleta em segundo plano. Se aparecerem poucos resultados, role a página para carregar mais e execute o mapeamento novamente.

### Capturar uma página individual

1. Abra uma página pública.
2. Selecione um trecho relevante, se desejar.
3. Clique no ícone da extensão.
4. Clique em **Capturar esta página**.
5. Classifique o sinal e adicione uma observação.
6. Clique em **Salvar captura no Chrome**.
7. Copie, abra a página original ou exporte o conjunto em JSON.

As capturas ficam no armazenamento local da extensão. Esta versão ainda não sincroniza automaticamente com a conta AutoViral; a importação autenticada para o Radar de Audiência será conectada na próxima etapa.

## Permissões

- `activeTab`: acesso temporário à aba ativa após ação do usuário.
- `scripting`: leitura dos metadados e do texto selecionado da página ativa.
- `storage`: guardar as capturas localmente.

Não usa permissões de leitura de todo o histórico, não monitora abas em segundo plano, não faz scraping em massa, não envia mensagens, não curte/comenta e não executa ações em nome do usuário.

## Distribuição

Esta é uma versão de desenvolvimento. Para instalação por usuários finais, será necessário validar os fluxos, preparar ícones finais, política de privacidade e publicar na Chrome Web Store (ou distribuir o pacote de forma controlada).
