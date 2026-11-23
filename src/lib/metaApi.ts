import { firebaseAuth } from './firebase';

// Public Worker endpoint. Override with VITE_META_API_URL when using a different
// Cloudflare workers.dev/custom-domain URL. No Meta secret belongs in the browser.
const META_API_URL = (
  import.meta.env.VITE_META_API_URL || 'https://autoviral-meta-api.marcellospropaganda.workers.dev'
).replace(/\/$/, '');

export async function invokeMetaApi<T = any>(path: string, body: Record<string, unknown> = {}): Promise<{ data: T | null; error: Error | null }> {
  if (!META_API_URL) return { data: null, error: new Error('Backend Meta ainda não configurado. Aguarde a publicação do Worker seguro.') };
  const user = firebaseAuth.currentUser;
  if (!user) return { data: null, error: new Error('Faça login no AutoViral antes de conectar a Meta.') };
  try {
    const idToken = await user.getIdToken();
    const response = await fetch(`${META_API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || data?.message || `Meta API respondeu HTTP ${response.status}`);
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Falha ao acessar o backend Meta.') };
  }
}

export function metaApiConfigured() {
  return Boolean(META_API_URL);
}
