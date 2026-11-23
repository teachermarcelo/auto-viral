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
3. Open **Storage → Rules** and publish the repository's `storage.rules` file. Storage may require enabling billing on newer Firebase projects; do not enable a paid plan without reviewing the quota and billing settings first.
4. In **Project settings → Your apps → AutoViral Web**, confirm the app ID matches `src/lib/firebase.ts`.
5. In the app, create an account or sign in. The first successful login provisions `workspaces/{uid}` and its owner membership automatically.

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

The first Firebase Authentication account owns a workspace whose document ID is the Firebase Auth UID. The initial release currently supports email/password login and signup.

## Migration safety

Firebase Authentication now controls app access, and workspace provisioning plus Product Center CRUD use Firestore. Product image uploads use Firebase Storage when the bucket is enabled and permitted by the project's plan. Supabase data is not deleted, overwritten, or migrated. Campaigns, communities, audiences, tracking, CRM, creative tools, integrations, and distribution still contain Supabase-backed operations and must be migrated module by module after a verified export/backup and record-count reconciliation.

Do not weaken Firestore rules to `allow read, write: if true`. The rules in this repository deny access unless the caller is authenticated and belongs to the workspace.
