import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { adminKeys, invalidateFeatures } from '@/features/admin/queries';

describe('adminKeys', () => {
  it('a lista de destaques fica sob ["me", …] e leva o utilizador da sessão', () => {
    expect(adminKeys.features('u1')).toEqual(['me', 'admin', 'features', 'u1']);
    expect(adminKeys.features(null)).toEqual(['me', 'admin', 'features', null]);
  });

  it('invalidateFeatures marca a lista de qualquer utilizador e os destaques do Início', async () => {
    const qc = new QueryClient();
    qc.setQueryData(adminKeys.features('u1'), []);
    qc.setQueryData(['catalog', 'featured'], []);
    await invalidateFeatures(qc);
    expect(qc.getQueryState(adminKeys.features('u1'))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['catalog', 'featured'])?.isInvalidated).toBe(true);
  });
});
