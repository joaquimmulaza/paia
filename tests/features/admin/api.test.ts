import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));

import {
  FEATURES_CHANGED,
  listFeatures,
  removeFeature,
  reorderFeatures,
  saveFeature,
  setFeatureActive,
} from '@/features/admin/api';

beforeEach(() => {
  vi.resetAllMocks();
});

const row = {
  id: 'f1',
  store_id: 's1',
  store_name: 'Doces da Ana',
  store_slug: 'doces-da-ana',
  store_status: 'approved',
  source: 'admin',
  position: 0,
  starts_at: null,
  ends_at: '2026-12-20T09:00:00+00:00',
  is_active: true,
  note: null,
  is_live: true,
};

describe('listFeatures', () => {
  it('chama admin_list_store_features e converte as colunas', async () => {
    rpc.mockResolvedValue({ data: [row], error: null });
    expect(await listFeatures()).toEqual([
      {
        id: 'f1',
        storeId: 's1',
        storeName: 'Doces da Ana',
        storeSlug: 'doces-da-ana',
        storeStatus: 'approved',
        source: 'admin',
        position: 0,
        startsAt: null,
        endsAt: '2026-12-20T09:00:00+00:00',
        isActive: true,
        note: null,
        isLive: true,
      },
    ]);
    expect(rpc).toHaveBeenCalledWith('admin_list_store_features');
  });

  it('NOT_ALLOWED vira a mensagem PT-AO', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'NOT_ALLOWED' } });
    await expect(listFeatures()).rejects.toThrow('Não tens permissão para fazer isto.');
  });

  it('uma rejeição de rede dá a mensagem genérica', async () => {
    rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(listFeatures()).rejects.toThrow('Algo correu mal. Tenta outra vez.');
  });
});

describe('saveFeature', () => {
  it('cria (p_id null) e devolve o id', async () => {
    rpc.mockResolvedValue({ data: 'novo-id', error: null });
    const id = await saveFeature({
      storeId: 's1',
      position: 3,
      startsAt: null,
      endsAt: '2026-12-20T10:00:00+01:00',
      note: null,
    });
    expect(id).toBe('novo-id');
    expect(rpc).toHaveBeenCalledWith('admin_save_store_feature', {
      p_id: null,
      p_store_id: 's1',
      p_position: 3,
      p_starts_at: null,
      p_ends_at: '2026-12-20T10:00:00+01:00',
      p_note: null,
    });
  });

  it('FEATURE_EXISTS vira «Esta loja já está em destaque.»', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'FEATURE_EXISTS' } });
    await expect(
      saveFeature({ storeId: 's1', position: 0, startsAt: null, endsAt: null, note: null }),
    ).rejects.toThrow('Esta loja já está em destaque.');
  });
});

describe('ações sobre um destaque', () => {
  it('setFeatureActive', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await setFeatureActive('f1', false);
    expect(rpc).toHaveBeenCalledWith('admin_set_store_feature_active', {
      p_id: 'f1',
      p_active: false,
    });
  });

  it('removeFeature', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await removeFeature('f1');
    expect(rpc).toHaveBeenCalledWith('admin_remove_store_feature', { p_id: 'f1' });
  });

  it('reorderFeatures envia os ids pela nova ordem', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await reorderFeatures(['b', 'a']);
    expect(rpc).toHaveBeenCalledWith('admin_reorder_store_features', { p_ids: ['b', 'a'] });
  });

  it('reorderFeatures com NOT_FOUND (lista desatualizada) diz que a lista mudou', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'NOT_FOUND' } });
    await expect(reorderFeatures(['a'])).rejects.toThrow(FEATURES_CHANGED);
    expect(FEATURES_CHANGED).toBe('A lista mudou. Atualizámos a ordem; tenta outra vez.');
  });
});
