import { supabase } from '@/lib/supabase';

export function stockLabel(stock: number): {
  kind: 'soldout' | 'last' | null;
  text: string | null;
} {
  if (stock <= 0) return { kind: 'soldout', text: 'Esgotado' };
  if (stock <= 3) return { kind: 'last', text: `Últimas ${stock}` };
  return { kind: null, text: null };
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Verdadeiro quando o produto foi criado há menos de 7 dias. */
export function isNew(createdAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(createdAt).getTime() < SEVEN_DAYS_MS;
}

export function publicImageUrl(bucket: 'product-media' | 'store-media', path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
