import type { Store } from './store.js';
import { MemoryStore } from './memory.js';
import { SupabaseStore } from './supabase.js';

export type { Store } from './store.js';
export { StoreError } from './store.js';
export { MemoryStore } from './memory.js';
export { SupabaseStore } from './supabase.js';

/**
 * Pick the storage backend:
 * - SUPABASE_URL + SUPABASE_SERVICE_KEY set → real Supabase (production).
 * - otherwise → file-backed MemoryStore (local dev / this build). No real
 *   data is ever touched unless the env vars are explicitly provided.
 */
export function createStore(env: Record<string, string | undefined> = process.env): Store {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    return new SupabaseStore(url, key);
  }
  return new MemoryStore(env.DSE_DATA_FILE ?? '.data/store.json');
}
