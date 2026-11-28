import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGES } from '@/lib/errors';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));

import {
  countPendingApplications,
  decideStore,
  getApplication,
  listApplications,
  listStoreDecisions,
} from '@/features/admin/applications-api';

beforeEach(() => {
  vi.resetAllMocks();
});

const listRow = {
  id: 's1',
  name: 'Doces da Ana',
  slug: 'doces-da-ana',
  category_name: 'Doces',
  logo_path: null,
  owner_name: 'Ana Paula',
  owner_affiliation: 'student',
  submitted_at: '2026-11-28T09:02:00+00:00',
  decided_at: null,
};

describe('listApplications', () => {
  it('chama admin_list_store_applications com o estado e converte as colunas', async () => {
    rpc.mockResolvedValue({ data: [listRow], error: null });
    expect(await listApplications('pending_approval')).toEqual([
      {
        id: 's1',
        name: 'Doces da Ana',
        slug: 'doces-da-ana',
        categoryName: 'Doces',
        logoPath: null,
        ownerName: 'Ana Paula',
        ownerAffiliation: 'student',
        submittedAt: '2026-11-28T09:02:00+00:00',
        decidedAt: null,
      },
    ]);
    expect(rpc).toHaveBeenCalledWith('admin_list_store_applications', {
      p_status: 'pending_approval',
      p_limit: 50,
    });
  });

  it('traduz NOT_ALLOWED', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'NOT_ALLOWED' } });
    await expect(listApplications('rejected')).rejects.toThrow(MESSAGES.notAllowed);
  });
});

describe('getApplication', () => {
  it('devolve null quando a loja não existe (0 linhas)', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await getApplication('s1')).toBeNull();
    expect(rpc).toHaveBeenCalledWith('admin_get_store_application', { p_store_id: 's1' });
  });

  it('converte a linha', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: 's1',
          name: 'Doces da Ana',
          slug: 'doces-da-ana',
          description: 'Bolos por fatia.',
          category_name: 'Doces',
          logo_path: 'stores/s1/logo-x.webp',
          cover_path: null,
          status: 'pending_approval',
          submitted_at: '2026-11-28T09:02:00+00:00',
          owner_name: 'Ana Paula',
          owner_affiliation: 'student',
          owner_created_at: '2026-11-01T10:00:00+00:00',
        },
      ],
      error: null,
    });
    expect(await getApplication('s1')).toEqual({
      id: 's1',
      name: 'Doces da Ana',
      slug: 'doces-da-ana',
      description: 'Bolos por fatia.',
      categoryName: 'Doces',
      logoPath: 'stores/s1/logo-x.webp',
      status: 'pending_approval',
      submittedAt: '2026-11-28T09:02:00+00:00',
      ownerName: 'Ana Paula',
      ownerAffiliation: 'student',
      ownerCreatedAt: '2026-11-01T10:00:00+00:00',
    });
  });
});

describe('listStoreDecisions', () => {
  it('converte as decisões e lê só as chaves booleanas da lista de verificação', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          decision: 'rejected',
          message: 'Falta a descrição.',
          checklist: { name_description: false, allowed: true, images: true, account: true },
          admin_name: 'Admin J.',
          created_at: '2026-11-27T16:05:00+00:00',
        },
        {
          decision: 'approved',
          message: null,
          checklist: {},
          admin_name: null,
          created_at: '2026-11-20T16:05:00+00:00',
        },
      ],
      error: null,
    });
    expect(await listStoreDecisions('s1')).toEqual([
      {
        decision: 'rejected',
        message: 'Falta a descrição.',
        checklist: { name_description: false, allowed: true, images: true, account: true },
        adminName: 'Admin J.',
        createdAt: '2026-11-27T16:05:00+00:00',
      },
      {
        decision: 'approved',
        message: null,
        checklist: { name_description: false, allowed: false, images: false, account: false },
        adminName: null,
        createdAt: '2026-11-20T16:05:00+00:00',
      },
    ]);
    expect(rpc).toHaveBeenCalledWith('admin_list_store_decisions', { p_store_id: 's1' });
  });
});

describe('countPendingApplications', () => {
  it('chama admin_count_pending_stores sem argumentos', async () => {
    rpc.mockResolvedValue({ data: 3, error: null });
    expect(await countPendingApplications()).toBe(3);
    expect(rpc).toHaveBeenCalledWith('admin_count_pending_stores');
  });
});

describe('decideStore', () => {
  const checklist = { name_description: true, allowed: true, images: false, account: true };

  it('envia a decisão, a lista de verificação e o submitted_at mostrado', async () => {
    rpc.mockResolvedValue({ data: 'approved', error: null });
    expect(
      await decideStore({
        storeId: 's1',
        decision: 'approved',
        message: '  ',
        checklist,
        expectedSubmittedAt: '2026-11-28T09:02:00+00:00',
      }),
    ).toBe('approved');
    expect(rpc).toHaveBeenCalledWith('admin_decide_store', {
      p_store_id: 's1',
      p_decision: 'approved',
      p_message: null,
      p_checklist: checklist,
      p_expected_submitted_at: '2026-11-28T09:02:00+00:00',
    });
  });

  it('ALREADY_DECIDED vira o aviso do A01b', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'ALREADY_DECIDED' } });
    await expect(
      decideStore({
        storeId: 's1',
        decision: 'rejected',
        message: 'Corrige a descrição.',
        checklist,
        expectedSubmittedAt: '2026-11-28T09:02:00+00:00',
      }),
    ).rejects.toThrow(MESSAGES.alreadyDecided);
  });

  it('uma falha sem código conhecido dá «Não foi possível guardar a decisão.»', async () => {
    rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(
      decideStore({
        storeId: 's1',
        decision: 'approved',
        message: '',
        checklist,
        expectedSubmittedAt: '2026-11-28T09:02:00+00:00',
      }),
    ).rejects.toThrow(MESSAGES.decisionFailed);
  });
});
