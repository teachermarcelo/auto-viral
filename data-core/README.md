# AutoViral Data Core

## Architecture decision

**Firebase is the primary data platform for AutoViral AI.** The production web app authenticates with Firebase Authentication and stores workspace-scoped operational data in Cloud Firestore.

- Firebase project: `autoviral-data-core`
- Web client: `src/lib/firebase.ts`
- Authentication and workspace provisioning: `src/App.tsx`
- Firestore compatibility adapter for existing modules: `src/lib/firestoreCompat.ts`
- Workspace isolation rules: `firestore.rules`
- Firebase setup and migration notes: `docs/FIREBASE_SETUP.md`

The app uses Firebase Authentication (email/password and Google) and Firestore. The Firebase Spark plan is the cost-first target. Do not enable paid Firebase products or upgrade billing without the owner's explicit decision.

## Role of other services

- **GitHub Pages** hosts the web frontend.
- **Cloudflare Workers** are optional secure server-side endpoints for integrations that cannot safely run in the browser (for example, OAuth callbacks, webhooks, AI provider secrets, and publishing APIs). They are not the primary database and must not be required for Firebase login or ordinary Firestore CRUD.
- The `data-core/api` Neon/Cloudflare scaffold is legacy/experimental infrastructure. It is not on the critical path for the Firebase-first app. Do not deploy it or require a `DATABASE_URL` for the app's core operation.
- Supabase/Neon legacy data must remain intact until a separate, verified export/import, reconciliation, rollback plan, and explicit owner approval. No automatic destructive migration is authorized.

## Current Firebase data layout

Operational records are stored under the authenticated workspace:

- `workspaces/{uid}`
- `workspaces/{uid}/members/{uid}`
- `workspaces/{uid}/products/{productId}`
- `workspaces/{uid}/campaigns/{campaignId}`
- Other module collections are mapped in `src/lib/firestoreCompat.ts`.

The compatibility adapter keeps the existing module query interface while modules are migrated incrementally. It currently reads each workspace collection and filters/sorts some results client-side; monitor Firestore usage and migrate high-volume queries to indexed Firestore queries before scaling.

## Required production checks

1. Confirm Email/Password and Google providers are enabled in Firebase Authentication.
2. Confirm `teachermarcelo.github.io` is an authorized Firebase Authentication domain.
3. Publish the repository's `firestore.rules` to the `autoviral-data-core` project.
4. Test signup, login, logout, workspace creation, and CRUD for each module.
5. Test that a second account cannot read or modify the first account's workspace.
6. Keep product images on public HTTPS URLs while using Spark; Firebase Storage uploads are not enabled in this cost-first setup.
7. Verify that any feature requiring a server-side integration reports a clear unavailable status until its secure Worker endpoint is deployed.

## Meta Ads — Worker Firebase-compatible implementado, publicação pendente

A nova integração server-side está em `workers/meta-api`. O frontend usa `src/lib/metaApi.ts` para enviar o Firebase ID token e chamar o Worker, sem expor credenciais Meta no navegador.

O Worker implementa:
- Verificação criptográfica de Firebase ID tokens (issuer, audience, expiração e assinatura RS256).
- OAuth Meta com state aleatório, uso único e validade de 10 minutos.
- Troca do authorization code por token Meta e tentativa de troca por token de longa duração.
- Criptografia AES-GCM de tokens antes de armazenar no Cloudflare KV.
- Consulta de contas de anúncios e campanhas.
- Pausar/ativar campanhas após conferir que a conta e a campanha pertencem uma à outra; leitura posterior confirma o estado.
- Registro de auditoria e CORS limitado ao domínio do AutoViral.
- Exclusão de campanhas não é exposta pela API.

**Ainda não está operacional em produção.** O Worker precisa ser criado/publicado separadamente e receber KV + secrets; o frontend precisa receber `VITE_META_API_URL` no build do GitHub Pages. A aplicação Meta precisa ter a callback URI exata cadastrada. O Worker não substitui a análise/aprovação de permissões pela Meta.

### Configuração manual mínima para ativação

1. Criar um KV namespace Cloudflare e substituir o placeholder `REPLACE_WITH_KV_NAMESPACE_ID` em `workers/meta-api/wrangler.toml`.
2. Criar um Worker separado chamado `autoviral-meta-api`, apontando para a pasta `workers/meta-api`; não sobrescrever o Worker legado `auto-viral`.
3. Configurar como Worker Secrets: `META_APP_SECRET` e `TOKEN_ENCRYPTION_KEY` (64 caracteres hexadecimais). O App ID e callback URL já estão preenchidos no `wrangler.toml`, mas devem ser conferidos no painel Meta/Cloudflare.
4. Definir a variável de repositório GitHub Actions `VITE_META_API_URL` com a origem HTTPS do Worker publicado e reconstruir GitHub Pages.
5. Adicionar `https://autoviral-meta-api.marcellospropaganda.workers.dev/meta/oauth/callback` às Valid OAuth Redirect URIs do app Meta, preservando as URLs Supabase antigas da outra plataforma.
6. Testar primeiro com um usuário que tenha papel no app Meta e uma conta de anúncios de teste. Solicitar Advanced Access/App Review e Business Verification quando a Meta exigir.

O Worker ainda precisa passar pelo CI de tipo e por teste real de OAuth/API. Não inserir App Secret, chave AES, tokens, service-account JSON ou credenciais privadas no GitHub, no frontend ou no chat.

## Data safety

- Do not delete, overwrite, or migrate legacy Supabase/Neon records as part of routine deployment.
- Do not commit service-account JSON, Admin SDK private keys, OAuth client secrets, webhook secrets, or database connection strings.
- Never weaken Firestore rules to public read/write.
- Back up and reconcile data before any future migration; preserve source IDs and timestamps and keep a rollback window.


## Known migration blocker — Chrome extension

The current `chrome-extension/` implementation is still coupled to the legacy Supabase project: `background.js` calls Supabase Auth/REST endpoints and `platform-bridge.js` extracts the Supabase browser session. It is **not Firebase-compatible yet**, even though the web app's primary data path is Firebase. Keep the legacy Supabase project intact until the extension is migrated and tested. Required follow-up: replace session bridging with Firebase Authentication, write community records to `workspaces/{uid}/communities` under the existing Firestore rules, and verify duplicate handling plus cross-workspace isolation. Do not claim extension-to-Firebase synchronization is operational before those tests pass.
