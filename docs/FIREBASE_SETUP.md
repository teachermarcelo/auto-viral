# AutoViral — Firebase foundation

## Connected project

- Firebase project: `autoviral-data-core`
- Web app: `AutoViral Web`
- Database: Cloud Firestore, default database
- Client initialization: `src/lib/firebase.ts`

The Firebase Web config is a public project identifier, not an Admin credential.
Never commit service-account JSON, Admin SDK private keys, or database secrets.

## Console steps required

1. In Firebase Console, open **Authentication → Sign-in method** and enable **Email/Password**.
2. Open **Firestore Database → Rules** and publish the repository's `firestore.rules` file.
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
