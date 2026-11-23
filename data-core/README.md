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

## Data safety

- Do not delete, overwrite, or migrate legacy Supabase/Neon records as part of routine deployment.
- Do not commit service-account JSON, Admin SDK private keys, OAuth client secrets, webhook secrets, or database connection strings.
- Never weaken Firestore rules to public read/write.
- Back up and reconcile data before any future migration; preserve source IDs and timestamps and keep a rollback window.


## Known migration blocker — Chrome extension

The current `chrome-extension/` implementation is still coupled to the legacy Supabase project: `background.js` calls Supabase Auth/REST endpoints and `platform-bridge.js` extracts the Supabase browser session. It is **not Firebase-compatible yet**, even though the web app's primary data path is Firebase. Keep the legacy Supabase project intact until the extension is migrated and tested. Required follow-up: replace session bridging with Firebase Authentication, write community records to `workspaces/{uid}/communities` under the existing Firestore rules, and verify duplicate handling plus cross-workspace isolation. Do not claim extension-to-Firebase synchronization is operational before those tests pass.
