import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('junta classes e ignora valores falsos', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b');
  });

  it('resolve conflitos entre as sombras do Cartaz', () => {
    expect(cn('shadow-hard', 'shadow-none')).toBe('shadow-none');
    expect(cn('shadow-hard-brand', 'shadow-hard')).toBe('shadow-hard');
  });

  it('resolve conflitos entre cores do tema sem confundir com tamanhos de letra', () => {
    expect(cn('text-ink', 'text-danger')).toBe('text-danger');
    expect(cn('text-base', 'text-ink')).toBe('text-base text-ink');
    expect(cn('bg-surface', 'bg-brand-tint')).toBe('bg-brand-tint');
  });
});
