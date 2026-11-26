import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type SupabaseEnv = Readonly<Record<string, unknown>>;

const clean = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

/** Valida as variáveis de ambiente públicas. Lança `MISSING_SUPABASE_ENV` se faltar alguma. */
export function readSupabaseEnv(env: SupabaseEnv): { url: string; anonKey: string } {
  const url = clean(env.VITE_SUPABASE_URL);
  const anonKey = clean(env.VITE_SUPABASE_ANON_KEY);
  if (!url || !anonKey) throw new Error('MISSING_SUPABASE_ENV');
  return { url, anonKey };
}

const { url, anonKey } = readSupabaseEnv(import.meta.env);

/** Cliente único. Só usa a chave pública (anon); nunca a service role. */
export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
