import {
  collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { firebaseAuth, firestore } from './firebase';

/**
 * Transitional Supabase-shaped adapter backed by workspace-scoped Firestore.
 * It keeps existing screens working while each module is migrated without
 * requiring a destructive rewrite of their query code.
 *
 * Reads are currently filtered client-side within the authenticated workspace.
 * Keep workspace collections modest until query-specific Firestore indexes and
 * native query implementations are introduced.
 */
type Row = Record<string, any>;
type Filter = { field: string; op: string; value: any; negate?: boolean };
type Order = { field: string; ascending: boolean };
type Result = { data: any; error: { message: string; code?: string } | null; count?: number | null };

const TABLES: Record<string, string> = {
  av_products: 'products',
  av_campaigns: 'campaigns',
  av_tracking_links: 'trackingLinks',
  av_campaign_posts: 'campaignPosts',
  av_campaign_runs: 'campaignRuns',
  av_leads: 'leads',
  av_communities: 'communities',
  av_audiences: 'audiences',
  av_tracking_events: 'trackingEvents',
  av_opportunities: 'opportunities',
  av_sales: 'sales',
  av_integrations: 'integrations',
  av_distribution_settings: 'distributionSettings',
  av_distribution_events: 'distributionEvents',
  av_distribution_reports: 'distributionReports',
  av_creative_assets: 'creativeAssets',
  av_social_posts: 'socialPosts',
  av_email_campaigns: 'emailCampaigns',
};

function clean(value: any): any {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object' && !(value instanceof Date) && typeof value.toDate !== 'function') {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, clean(v)]));
  }
  return value;
}
function compare(a: any, b: any): number {
  const left = a instanceof Date ? a.getTime() : a;
  const right = b instanceof Date ? b.getTime() : b;
  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
function matches(row: Row, filters: Filter[]): boolean {
  return filters.every(({ field, op, value, negate }) => {
    const actual = field === 'id' ? row.id : row[field];
    let result = true;
    switch (op) {
      case 'eq': case 'is': result = actual === value; break;
      case 'neq': result = actual !== value; break;
      case 'in': result = Array.isArray(value) && value.includes(actual); break;
      case 'gte': result = compare(actual, value) >= 0; break;
      case 'gt': result = compare(actual, value) > 0; break;
      case 'lte': result = compare(actual, value) <= 0; break;
      case 'lt': result = compare(actual, value) < 0; break;
      default: result = true;
    }
    return negate ? !result : result;
  });
}

class FirestoreQuery {
  private operation: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: Row | Row[] | null = null;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private maxRows: number | null = null;
  private returnRows = false;
  private singleMode: 'many' | 'single' | 'maybe' = 'many';
  private conflict: string[] = [];

  constructor(private table: string, private workspaceId: string) {}

  select(_columns?: string, _options?: any) { this.returnRows = true; return this; }
  eq(field: string, value: any) { if (field !== 'workspace_id') this.filters.push({ field, op: 'eq', value }); return this; }
  neq(field: string, value: any) { this.filters.push({ field, op: 'neq', value }); return this; }
  is(field: string, value: any) { this.filters.push({ field, op: 'is', value }); return this; }
  in(field: string, value: any[]) { this.filters.push({ field, op: 'in', value }); return this; }
  gte(field: string, value: any) { this.filters.push({ field, op: 'gte', value }); return this; }
  gt(field: string, value: any) { this.filters.push({ field, op: 'gt', value }); return this; }
  lte(field: string, value: any) { this.filters.push({ field, op: 'lte', value }); return this; }
  lt(field: string, value: any) { this.filters.push({ field, op: 'lt', value }); return this; }
  not(field: string, op: string, value: any) { this.filters.push({ field, op, value, negate: true }); return this; }
  filter(field: string, op: string, value: any) { this.filters.push({ field, op, value }); return this; }
  order(field: string, options?: { ascending?: boolean }) { this.orders.push({ field, ascending: options?.ascending !== false }); return this; }
  limit(value: number) { this.maxRows = Math.max(0, value); return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }
  insert(payload: Row | Row[]) { this.operation = 'insert'; this.payload = payload; return this; }
  upsert(payload: Row | Row[], options?: { onConflict?: string }) {
    this.operation = 'upsert'; this.payload = payload;
    this.conflict = (options?.onConflict || 'id').split(',').map(x => x.trim()).filter(Boolean);
    return this;
  }
  update(payload: Row) { this.operation = 'update'; this.payload = payload; return this; }
  delete() { this.operation = 'delete'; return this; }

  private async execute(): Promise<Result> {
    const user = firebaseAuth.currentUser;
    if (!user) return { data: null, error: { message: 'Faça login para acessar os dados do workspace.', code: 'auth_required' } };
    const subcollection = TABLES[this.table];
    if (!subcollection) return { data: null, error: { message: `Coleção não mapeada no AutoViral Data Core: ${this.table}`, code: 'table_not_mapped' } };
    const path = `workspaces/${this.workspaceId}/${subcollection}`;
    if (this.workspaceId !== user.uid) return { data: null, error: { message: 'Acesso negado: workspace diferente do usuário autenticado.', code: 'workspace_mismatch' } };

    try {
      if (this.operation === 'insert' || this.operation === 'upsert') {
        const rows = (Array.isArray(this.payload) ? this.payload : [this.payload || {}]).map(clean);
        const written: Row[] = [];
        for (const row of rows) {
          const id = String(row.id || (this.table === 'av_distribution_settings' ? 'workspace-settings' : crypto.randomUUID()));
          const ref = doc(firestore, path, id);
          if (this.operation === 'upsert') {
            let targetId = id;
            if (!row.id && this.conflict.length && this.conflict[0] !== 'id') {
              const existing = await getDocs(collection(firestore, path));
              const found = existing.docs.find(item => this.conflict.every(key => item.data()[key] === row[key]));
              if (found) targetId = found.id;
            }
            await setDoc(doc(firestore, path, targetId), { ...row, id: targetId, workspace_id: this.workspaceId, updated_at: new Date().toISOString() }, { merge: true });
            written.push({ ...row, id: targetId, workspace_id: this.workspaceId });
          } else {
            await setDoc(ref, { ...row, id, workspace_id: this.workspaceId, created_at: row.created_at || new Date().toISOString() });
            written.push({ ...row, id, workspace_id: this.workspaceId });
          }
        }
        return { data: this.returnRows ? this.shape(written) : null, error: null, count: written.length };
      }

      const snapshot = await getDocs(collection(firestore, path));
      let rows = snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as Row).filter(row => matches(row, this.filters));
      if (this.operation === 'update') {
        const patch = { ...clean(this.payload || {}), updated_at: new Date().toISOString() };
        for (const row of rows) await updateDoc(doc(firestore, path, row.id), patch);
        const updated = rows.map(row => ({ ...row, ...patch }));
        return { data: this.returnRows ? this.shape(updated) : null, error: null, count: updated.length };
      }
      if (this.operation === 'delete') {
        for (const row of rows) await deleteDoc(doc(firestore, path, row.id));
        return { data: this.returnRows ? this.shape(rows) : null, error: null, count: rows.length };
      }
      for (const order of [...this.orders].reverse()) {
        rows.sort((a, b) => compare(a[order.field], b[order.field]) * (order.ascending ? 1 : -1));
      }
      if (this.maxRows !== null) rows = rows.slice(0, this.maxRows);
      return { data: this.shape(rows), error: null, count: rows.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao acessar o Firestore.';
      return { data: null, error: { message, code: 'firestore_error' } };
    }
  }

  private shape(rows: Row[]): any {
    if (this.singleMode === 'single') {
      if (!rows.length) throw new Error('Esperava exatamente um registro, mas nenhum foi encontrado.');
      if (rows.length > 1) throw new Error('Esperava exatamente um registro, mas foram encontrados vários.');
      return rows[0];
    }
    if (this.singleMode === 'maybe') {
      if (rows.length > 1) throw new Error('Esperava no máximo um registro, mas foram encontrados vários.');
      return rows[0] || null;
    }
    return rows;
  }

  then(resolve: (value: Result) => any, reject?: (reason: any) => any) {
    return this.execute().then(resolve, reject);
  }
}

const unavailable = (feature: string) => ({
  data: null,
  error: { message: `${feature} ainda não foi migrado para um endpoint seguro do AutoViral Data Core. Os dados locais do Firestore continuam disponíveis.`, code: 'backend_not_migrated' },
});

export const supabase: any = {
  from: (table: string) => new FirestoreQuery(table, firebaseAuth.currentUser?.uid || ''),
  auth: {
    getUser: async () => {
      const user = firebaseAuth.currentUser;
      return { data: { user: user ? { id: user.uid, email: user.email, user_metadata: { full_name: user.displayName } } : null }, error: null };
    },
  },
  functions: { invoke: async (name: string, _options?: any) => unavailable(`A integração ${name}`) },
  rpc: async (name: string, _args?: any) => unavailable(`A função segura ${name}`),
  storage: {
    from: (_bucket: string) => ({
      upload: async (_path: string, _file: File, _options?: any) => unavailable('Upload de arquivos'),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: '' } }),
      remove: async (_paths: string[]) => unavailable('Remoção de arquivos'),
    }),
  },
};

export const isSupabaseConfigured = false;
export const dataCoreProvider = 'firebase-firestore' as const;
