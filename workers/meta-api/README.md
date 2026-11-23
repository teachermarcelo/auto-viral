# AutoViral Meta API Worker

Backend seguro de OAuth e Meta Marketing API para o AutoViral AI, usando Firebase Authentication e Cloudflare Workers.

## Configuração do Worker no Cloudflare

Ao conectar o repositório `teachermarcelo/auto-viral` ao Worker:

- **Nome:** `autoviral-meta-api`
- **Diretório raiz / Root directory:** `workers/meta-api`
- **Comando da build:** deixar vazio
- **Comando de implantação:** `npx wrangler deploy`
- **Comando de preview:** `npx wrangler dev` (opcional)
- **Token de API:** token de deploy da Cloudflare com permissão de editar Workers e acessar KV
- **Namespace KV:** o binding `META_CONNECTIONS` já está declarado no `wrangler.toml`; ele usa o namespace criado para `AUTOVIRAL_META_CONNECTIONS`.

Não use `data-core/api` como diretório raiz. Esse diretório contém outro serviço e não é o backend OAuth da Meta.

## Variáveis e secrets

O `wrangler.toml` já declara as variáveis públicas `APP_ORIGIN`, `FIREBASE_PROJECT_ID`, `META_GRAPH_VERSION`, `META_APP_ID` e `OAUTH_REDIRECT_URI`.

Configure no painel do Worker, em **Settings → Variables and Secrets**, como **Secrets** (nunca como variáveis públicas):

- `META_APP_SECRET`: App Secret do aplicativo existente VIRAL SALES AI.
- `TOKEN_ENCRYPTION_KEY`: chave aleatória de 32 bytes em 64 caracteres hexadecimais.

O App ID não é segredo. Nunca coloque o App Secret, tokens Meta ou a chave de criptografia no GitHub, no frontend ou em mensagens.

## URLs

- Worker: `https://autoviral-meta-api.marcellospropaganda.workers.dev`
- Health check: `https://autoviral-meta-api.marcellospropaganda.workers.dev/health`
- Callback OAuth: `https://autoviral-meta-api.marcellospropaganda.workers.dev/meta/oauth/callback`

Cadastre exatamente a URL de callback acima em **Meta for Developers → VIRAL SALES AI → Login do Facebook → Configurações → URIs de redirecionamento do OAuth válidos**. Preserve as URLs antigas usadas pela outra plataforma.

## Endpoints

- `GET /health`: verifica se o Worker está configurado, sem expor segredos.
- `POST /meta/oauth/start`: exige Firebase ID token e inicia OAuth.
- `GET /meta/oauth/callback`: valida state de uso único, troca o code e guarda token criptografado no KV.
- `POST /meta/accounts`: lista contas de anúncios autorizadas.
- `POST /meta/campaigns`: lista campanhas da conta verificada.
- `POST /meta/campaigns/action`: pausa ou ativa uma campanha após validar sua associação à conta.

## Segurança e limites

- Firebase ID tokens são verificados por assinatura e claims.
- OAuth state é aleatório, de uso único e expira em 10 minutos.
- Tokens Meta são criptografados com AES-GCM antes de serem armazenados no KV.
- O App Secret e os tokens Meta nunca são enviados ao navegador.
- As operações de campanha são limitadas a contas autorizadas e não há endpoint de exclusão.
- O CORS aceita apenas a origem do GitHub Pages configurada.

## Aprovação Meta

Publicar o Worker não aprova o aplicativo Meta. A Meta ainda pode exigir verificação empresarial, App Review e Advanced Access para permissões como `ads_read`, `ads_management` e `business_management`. Enquanto o aplicativo estiver em modo de desenvolvimento, somente pessoas com função no app podem testar conforme as regras da Meta. Comece com uma conta de anúncios de teste.
