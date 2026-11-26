import { describe, expect, it } from 'vitest';
import { readSupabaseEnv } from '@/lib/supabase';

describe('readSupabaseEnv', () => {
  it('devolve url e chave quando existem', () => {
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: 'http://x', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual(
      {
        url: 'http://x',
        anonKey: 'k',
      },
    );
  });
  it.each([
    [{}],
    [{ VITE_SUPABASE_URL: 'http://x' }],
    [{ VITE_SUPABASE_ANON_KEY: 'k' }],
    [{ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: 'k' }],
    [{ VITE_SUPABASE_URL: 'http://x', VITE_SUPABASE_ANON_KEY: '  ' }],
  ])('lança MISSING_SUPABASE_ENV para %j', (env) => {
    expect(() => readSupabaseEnv(env)).toThrow('MISSING_SUPABASE_ENV');
  });
});
