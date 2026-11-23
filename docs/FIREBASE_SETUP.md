# AutoViral — Firebase foundation

## Connected project

- Firebase project: `autoviral-data-core`
- Web app: `AutoViral Web`
- Database: Cloud Firestore, default database
- Client initialization: `src/lib/firebase.ts`

The Firebase Web config is a public project identifier, not an Admin credential.
Never commit service-account JSON, Admin SDK private keys, or database secrets.

## Console steps required

1. In Firebase Console, open **Authentication → Sign-in method** and enable **Email/Password** and **Google**. In **Authentication → Settings → Authorized domains**, add `teachermarcelo.github.io` (the GitHub Pages host) if it is not already listed.
2. Open **Firestore Database → Rules** and publish the latest repository `firestore.rules` file. It allows a signed-in user to bootstrap only their own workspace; publish the updated file after every rules change.
3. In **Project settings → Your apps → AutoViral Web**, confirm the app ID matches `src/lib/firebase.ts`.
4. In the app, create an account or sign in. The first successful login provisions `workspaces/{uid}` and its owner membership automatically.
5. Do not activate Firebase Storage on the Spark plan. The repository's `storage.rules` is only a future reference; product image upload currently accepts a public image URL to avoid a billing upgrade.

## Data layout

The new database uses workspace-scoped collections:

- `workspaces/{workspaceId}`
- `workspaces/{workspaceId}/members/{uid}`
- `workspaces/{workspaceId}/products/{productId}`
- `workspaces/{workspaceId}/campaigns/{campaignId}`
- `workspaces/{workspaceId}/audiences/{audienceId}`
- `workspaces/{workspaceId}/communities/{communityId}`
- `workspaces/{workspaceId}/trackingLinks/{linkId}`
- `workspaces/{workspaceId}/trackingEvents/{eventId}`
- `workspaces/{workspaceId}/distributionRuns/{runId}`
- `workspaces/{workspaceId}/distributionTasks/{taskId}`
- `workspaces/{workspaceId}/auditEvents/{eventId}`

The first Firebase Authentication account owns a workspace whose document ID is the Firebase Auth UID. The initial release supports email/password login, signup, and Google sign-in.

## Migration safety

Firebase Authentication controls app access and workspace provisioning. Operational modules retain their existing Supabase-shaped query interface through `src/lib/firestoreCompat.ts`, which routes supported CRUD operations to workspace-scoped Firestore collections. This is a compatibility bridge, not the final optimized repository layer: it currently reads a workspace collection and filters/sorts in the client, so keep datasets modest and monitor Firestore quotas. Product and campaign media uploads remain disabled on Spark; use public HTTPS image URLs. Meta OAuth/Ads, Gemini generation, Kiwify secret RPC, Story publication, and other server-side actions return an explicit `backend_not_migrated` error until secure Workers/Functions replace the legacy Edge Functions. Supabase data is not deleted, overwritten, or migrated; it remains preserved as the legacy source until export, reconciliation, and a separately approved cutover.

Do not weaken Firestore rules to `allow read, write: if true`. The rules in this repository deny access unless the caller is authenticated and belongs to the workspace.

## Meta Ads backend (new Firebase-compatible Worker)

The secure Meta integration now lives in `workers/meta-api` and does not call the legacy Supabase Edge Functions. It verifies Firebase ID tokens, handles one-time OAuth state, encrypts Meta access tokens with AES-GCM in Cloudflare KV, lists authorized ad accounts/campaigns, and supports only pause/activate actions with ownership checks and read-after-write verification. Campaign deletion is intentionally not exposed.

The frontend reads `VITE_META_API_URL` and calls the Worker with the signed-in Firebase user's ID token. Until this variable points to a deployed Worker, the Meta connection controls remain unavailable.

### Remaining one-time operator setup

1. Create a Cloudflare KV namespace and replace the placeholder namespace ID in `workers/meta-api/wrangler.toml`.
2. Deploy the Worker as a separate service named `autoviral-meta-api`; do not repoint the existing `auto-viral` Worker or remove its legacy routes.
3. Add Worker secrets: `META_APP_ID`, `META_APP_SECRET`, `TOKEN_ENCRYPTION_KEY` (64 hex characters), and `OAUTH_REDIRECT_URI`.
4. Set the GitHub Pages build environment variable `VITE_META_API_URL` to the deployed Worker origin, then rebuild the frontend.
5. In the existing VIRAL SALES AI Meta app, add the exact Worker callback URL to Valid OAuth Redirect URIs. Preserve all existing Supabase callback URLs used by the other owned platform.
6. Confirm the app has the Marketing API use case, enable/configure Facebook Login for Business as required, and request only the necessary permissions. Advanced Access/App Review and business verification remain Meta-controlled and cannot be bypassed by code.

Do not put the Meta App Secret or encryption key in GitHub, frontend environment variables, or chat. The existing Cloudflare project currently has a failed build because its configured root directory `data-core/api` does not exist on `main`; configure a separate Worker project with root `workers/meta-api` rather than deploying the experimental Neon scaffold or overwriting the existing `auto-viral` service.
