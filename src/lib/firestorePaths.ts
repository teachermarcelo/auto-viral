/**
 * Canonical Firestore paths for workspace-scoped AutoViral records.
 * Keep every operational record beneath a workspace document.
 */
export const workspacePath = (workspaceId: string) =>
  `workspaces/${workspaceId}`;

export const workspaceCollectionPath = (
  workspaceId: string,
  collection:
    | 'products'
    | 'campaigns'
    | 'audiences'
    | 'communities'
    | 'trackingLinks'
    | 'trackingEvents'
    | 'distributionRuns'
    | 'distributionTasks'
    | 'auditEvents',
) => `${workspacePath(workspaceId)}/${collection}`;

export const workspaceMemberPath = (workspaceId: string, uid: string) =>
  `${workspacePath(workspaceId)}/members/${uid}`;
