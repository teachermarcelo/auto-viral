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
2. Open **Firestore Database → Rules**.
3. Publish the repository's `firestore.rules` file.
4. In **Project settings → Your apps → AutoViral Web**, confirm the app ID matches the configuration in `src/lib/firebase.ts`.

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

## Migration safety

This commit only adds the Firebase client SDK and security-rule foundation. It does not delete, overwrite, or migrate Supabase data, and it does not switch existing modules to Firestore. The current app still has Supabase-dependent modules and temporary demo mode. Migrate one module at a time after an export/backup and a record-count reconciliation.

Do not weaken Firestore rules to `allow read, write: if true`. The rules in this repository deny access unless the caller is authenticated and belongs to the workspace.
