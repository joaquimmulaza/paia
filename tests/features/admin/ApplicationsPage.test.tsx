import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ApplicationDetail,
  ApplicationSummary,
  StoreDecisionEntry,
} from '@/features/admin/types';
import { MESSAGES } from '@/lib/errors';

const api = vi.hoisted(() => ({
  listApplications: vi.fn(),
  getApplication: vi.fn(),
  listStoreDecisions: vi.fn(),
  countPendingApplications: vi.fn(),
  decideStore: vi.fn(),
}));
vi.mock('@/features/admin/applications-api', () => api);

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'admin-1' } }, loading: false }),
  currentUserId: () => 'admin-1',
}));

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn() }));
vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast,
}));

import { ApplicationsPage } from '@/features/admin/ApplicationsPage';
import { renderRoutes } from '../../utils/renderRoutes';

const DAY = 86_400_000;

function summary(over: Partial<ApplicationSummary> & Pick<ApplicationSummary, 'id' | 'name'>) {
  return {
    slug: over.id,
    categoryName: 'Doces',
    logoPath: null,
    ownerName: 'Ana Paula',
    ownerAffiliation: 'student',
    submittedAt: '2026-11-28T09:02:00.000Z',
    decidedAt: null,
    ...over,
  } satisfies ApplicationSummary;
}

const PENDING: ApplicationSummary[] = [
  summary({ id: 'doces-da-ana', name: 'Doces da Ana' }),
  summary({
    id: 'capas-da-rita',
    name: 'Capas da Rita',
    categoryName: 'Acessórios',
    ownerName: 'Rita Mendes',
    submittedAt: '2026-11-28T10:40:00.000Z',
  }),
];

function detailOf(s: ApplicationSummary, over: Partial<ApplicationDetail> = {}): ApplicationDetail {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: 'Bolos por fatia e encomendas para aniversários.',
    categoryName: s.categoryName,
    logoPath: null,
    status: 'pending_approval',
    submittedAt: s.submittedAt,
    ownerName: s.ownerName,
    ownerAffiliation: s.ownerAffiliation,
    ownerCreatedAt: new Date(Date.now() - 21 * DAY).toISOString(),
    ...over,
  };
}

function mount() {
  return renderRoutes(
    [{ path: '/admin/candidaturas', element: <ApplicationsPage /> }],
    '/admin/candidaturas',
  );
}

async function detailBox(name: string) {
  return screen.findByRole('region', { name });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listApplications.mockImplementation(async (status: string) =>
    status === 'pending_approval' ? PENDING : [],
  );
  api.getApplication.mockImplementation(async (id: string) => {
    const s = PENDING.find((p) => p.id === id);
    return s ? detailOf(s) : null;
  });
  api.listStoreDecisions.mockResolvedValue([]);
  api.countPendingApplications.mockResolvedValue(PENDING.length);
});

describe('ApplicationsPage (A01)', () => {
  it('tem o título, os separadores e «Candidaturas» com o contador na navegação', async () => {
    mount();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Candidaturas de lojas' }),
    ).toBeInTheDocument();
    expect(document.title).toBe('Candidaturas · Administração · PAIÁ');
    const filters = screen.getByRole('group', { name: 'Filtrar' });
    expect(
      await within(filters).findByRole('button', { name: 'Por analisar · 2' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(within(filters).getByRole('button', { name: 'Recusadas' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(within(filters).getByRole('button', { name: 'Aprovadas' })).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: 'Administração' });
    // O primeiro link é o logótipo; depois Candidaturas (com o contador) e Destaques, por esta ordem.
    const links = within(nav).getAllByRole('link').slice(1);
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleName('Candidaturas, 2 por analisar');
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(links[0]).toHaveAttribute('href', '/admin/candidaturas');
    expect(links[1]).toHaveAccessibleName('Destaques');
  });

  it('lista as pendentes e mostra a primeira no detalhe, com o dono e a idade da conta', async () => {
    mount();
    const list = await screen.findByRole('region', { name: 'Lista de candidaturas' });
    expect(await within(list).findByRole('button', { name: 'Doces da Ana' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(within(list).getByRole('button', { name: 'Capas da Rita' })).not.toHaveAttribute(
      'aria-current',
    );
    const detail = await detailBox('Doces da Ana');
    expect(within(detail).getByText('Em análise')).toBeInTheDocument();
    expect(
      await within(detail).findByText('Ana Paula · Estudante · conta criada há 3 semanas'),
    ).toBeInTheDocument();
    expect(within(detail).getByText('…/loja/doces-da-ana')).toBeInTheDocument();
    for (const label of [
      'Nome e descrição dizem claramente o que a loja vende.',
      'A categoria e os produtos são permitidos na comunidade.',
      'Imagens adequadas e sem dados pessoais visíveis.',
      'Conta de estudante com email confirmado.',
    ]) {
      expect(within(detail).getByRole('checkbox', { name: label })).not.toBeChecked();
    }
    expect(within(detail).getByText('A decisão fica no histórico, com o teu nome e a data.'));
  });

  it('com 0 candidaturas mostra o estado vazio', async () => {
    api.listApplications.mockResolvedValue([]);
    api.countPendingApplications.mockResolvedValue(0);
    mount();
    expect(await screen.findByText('Não há candidaturas por analisar.')).toBeInTheDocument();
    expect(
      screen.getByText('Os pedidos novos aparecem aqui, do mais antigo para o mais recente.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Por analisar · 0' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprovar loja' })).not.toBeInTheDocument();
    expect(api.getApplication).not.toHaveBeenCalled();
  });

  it('recusar sem mensagem mostra o erro do A01b e não chama a API', async () => {
    const user = userEvent.setup();
    mount();
    const detail = await detailBox('Doces da Ana');
    await user.click(within(detail).getByRole('button', { name: 'Recusar' }));
    const field = within(detail).getByLabelText('Mensagem para a candidata');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(MESSAGES.messageRequired);
    expect(field).toHaveFocus();
    expect(api.decideStore).not.toHaveBeenCalled();
    // Ao escrever, o erro sai.
    await user.type(field, 'Corrige');
    expect(field).not.toHaveAttribute('aria-invalid');
  });

  it('aprovar envia { name_description, allowed, images, account } com os valores das caixas', async () => {
    const user = userEvent.setup();
    api.decideStore.mockResolvedValue('approved');
    mount();
    const detail = await detailBox('Doces da Ana');
    await user.click(
      within(detail).getByRole('checkbox', {
        name: 'Nome e descrição dizem claramente o que a loja vende.',
      }),
    );
    await user.click(
      within(detail).getByRole('checkbox', {
        name: 'Imagens adequadas e sem dados pessoais visíveis.',
      }),
    );
    await user.click(within(detail).getByRole('button', { name: 'Aprovar loja' }));
    await waitFor(() => expect(api.decideStore).toHaveBeenCalledTimes(1));
    expect(api.decideStore).toHaveBeenCalledWith({
      storeId: 'doces-da-ana',
      decision: 'approved',
      message: '',
      checklist: { name_description: true, allowed: false, images: true, account: false },
      expectedSubmittedAt: '2026-11-28T09:02:00.000Z',
    });
  });

  it('o sucesso dá o aviso do A01b com o primeiro nome e passa à candidatura seguinte', async () => {
    const user = userEvent.setup();
    api.decideStore.mockImplementation(async () => {
      // Depois de decidir, a primeira sai da lista.
      api.listApplications.mockImplementation(async (status: string) =>
        status === 'pending_approval' ? PENDING.slice(1) : [],
      );
      api.countPendingApplications.mockResolvedValue(1);
      return 'approved';
    });
    mount();
    const detail = await detailBox('Doces da Ana');
    await user.click(within(detail).getByRole('button', { name: 'Aprovar loja' }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Loja aprovada. A Ana já pode publicar produtos.'),
    );
    const next = await detailBox('Capas da Rita');
    expect(within(next).getByRole('heading', { name: 'Capas da Rita' })).toHaveFocus();
    expect(await screen.findByRole('button', { name: 'Por analisar · 1' })).toBeInTheDocument();
  });

  it('recusar com mensagem envia a mensagem e dá o aviso da recusa; sem seguinte, estado vazio', async () => {
    const user = userEvent.setup();
    api.listApplications.mockImplementation(async (status: string) =>
      status === 'pending_approval' ? PENDING.slice(0, 1) : [],
    );
    api.decideStore.mockImplementation(async () => {
      api.listApplications.mockResolvedValue([]);
      api.countPendingApplications.mockResolvedValue(0);
      return 'rejected';
    });
    mount();
    const detail = await detailBox('Doces da Ana');
    await user.type(
      within(detail).getByLabelText('Mensagem para a candidata'),
      'Acrescenta os produtos principais.',
    );
    await user.click(within(detail).getByRole('button', { name: 'Recusar' }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Loja recusada. A mensagem foi enviada à candidata.',
      ),
    );
    expect(api.decideStore).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'rejected',
        message: 'Acrescenta os produtos principais.',
      }),
    );
    expect(await screen.findByText('Não há candidaturas por analisar.')).toBeInTheDocument();
  });

  it('ALREADY_DECIDED mostra o aviso, volta a ler o detalhe, a lista e o contador', async () => {
    const user = userEvent.setup();
    api.decideStore.mockImplementation(async () => {
      api.getApplication.mockImplementation(async (id: string) => {
        const s = PENDING.find((p) => p.id === id);
        return s ? detailOf(s, { status: 'approved' }) : null;
      });
      api.listApplications.mockImplementation(async (status: string) =>
        status === 'pending_approval' ? PENDING.slice(1) : [],
      );
      api.countPendingApplications.mockResolvedValue(1);
      throw new Error(MESSAGES.alreadyDecided);
    });
    mount();
    const detail = await detailBox('Doces da Ana');
    await waitFor(() => expect(api.getApplication).toHaveBeenCalledTimes(1));
    await user.click(within(detail).getByRole('button', { name: 'Aprovar loja' }));
    expect(await within(detail).findByRole('alert')).toHaveTextContent(MESSAGES.alreadyDecided);
    // O detalhe é lido de novo e mostra o estado atual, sem o formulário.
    expect(await within(detail).findByText('Aprovada')).toBeInTheDocument();
    expect(within(detail).queryByRole('button', { name: 'Aprovar loja' })).not.toBeInTheDocument();
    expect(api.getApplication).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('button', { name: 'Por analisar · 1' })).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    // O foco não cai no <body>: vai para o título do detalhe.
    expect(within(detail).getByRole('heading', { name: 'Doces da Ana' })).toHaveFocus();
  });

  it('ALREADY_DECIDED de um reenvio mantém a mensagem escrita', async () => {
    const user = userEvent.setup();
    api.decideStore.mockImplementation(async () => {
      // A loja foi decidida e reenviada: continua pendente, com outro submitted_at.
      api.getApplication.mockImplementation(async (id: string) => {
        const s = PENDING.find((p) => p.id === id);
        return s ? detailOf(s, { submittedAt: '2026-11-28T11:00:00.000Z' }) : null;
      });
      throw new Error(MESSAGES.alreadyDecided);
    });
    mount();
    const detail = await detailBox('Doces da Ana');
    const field = within(detail).getByLabelText('Mensagem para a candidata');
    await user.type(field, 'Revê as fotos.');
    await user.click(within(detail).getByRole('button', { name: 'Recusar' }));
    expect(await within(detail).findByRole('alert')).toHaveTextContent(MESSAGES.alreadyDecided);
    await waitFor(() => expect(api.getApplication).toHaveBeenCalledTimes(2));
    expect(within(detail).getByLabelText('Mensagem para a candidata')).toHaveValue(
      'Revê as fotos.',
    );
  });

  it('outra falha mostra o erro do A01b e deixa tentar outra vez', async () => {
    const user = userEvent.setup();
    api.decideStore.mockRejectedValue(new Error(MESSAGES.decisionFailed));
    mount();
    const detail = await detailBox('Doces da Ana');
    await user.click(within(detail).getByRole('button', { name: 'Aprovar loja' }));
    expect(await within(detail).findByRole('alert')).toHaveTextContent(
      'Não foi possível guardar a decisão. Tenta outra vez.',
    );
    expect(within(detail).getByRole('button', { name: 'Aprovar loja' })).toBeEnabled();
  });

  it('escolher outra candidatura na lista mostra-a no detalhe', async () => {
    const user = userEvent.setup();
    mount();
    const list = await screen.findByRole('region', { name: 'Lista de candidaturas' });
    await user.click(await within(list).findByRole('button', { name: 'Capas da Rita' }));
    const detail = await detailBox('Capas da Rita');
    expect(
      await within(detail).findByText('Rita Mendes · Estudante · conta criada há 3 semanas'),
    ).toBeInTheDocument();
  });
});

describe('ApplicationsPage (A01b), recusadas e histórico', () => {
  const REJECTED = summary({
    id: 'capas-da-rita',
    name: 'Capas da Rita',
    categoryName: 'Acessórios',
    ownerName: 'Rita Mendes',
    submittedAt: '2026-11-27T15:40:00.000Z',
    decidedAt: '2026-11-27T16:05:00.000Z',
  });
  const DECISIONS: StoreDecisionEntry[] = [
    {
      decision: 'rejected',
      message: 'A descrição não diz o que vendes.',
      checklist: { name_description: false, allowed: true, images: true, account: true },
      adminName: 'Admin J.',
      createdAt: '2026-11-27T16:05:00.000Z',
    },
  ];

  beforeEach(() => {
    api.listApplications.mockImplementation(async (status: string) =>
      status === 'rejected' ? [REJECTED] : PENDING,
    );
    api.getApplication.mockImplementation(async (id: string) =>
      id === REJECTED.id ? detailOf(REJECTED, { status: 'rejected' }) : detailOf(PENDING[0]!),
    );
    api.listStoreDecisions.mockImplementation(async (id: string) =>
      id === REJECTED.id ? DECISIONS : [],
    );
  });

  it('o separador «Recusadas» lista as recusadas e mostra a mensagem, a checklist e o histórico', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Recusadas' }));
    expect(screen.getByRole('button', { name: 'Recusadas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(api.listApplications).toHaveBeenCalledWith('rejected');
    const list = await screen.findByRole('region', { name: 'Candidaturas recusadas' });
    expect(await within(list).findByRole('button', { name: 'Capas da Rita' })).toBeInTheDocument();

    const detail = await detailBox('Capas da Rita');
    expect(await within(detail).findByText('Recusada')).toBeInTheDocument();
    expect(within(detail).queryByRole('button', { name: 'Recusar' })).not.toBeInTheDocument();
    expect(await within(detail).findByText('3 de 4 itens confirmados')).toBeInTheDocument();
    const history = within(detail).getByRole('list');
    const items = within(history).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/Recusada por Admin J\./);
    expect(items[0]).toHaveTextContent('A descrição não diz o que vendes.');
    expect(items[1]).toHaveTextContent(/Enviada para análise\./);
    // A mensagem enviada aparece também nos dados da decisão.
    expect(within(detail).getAllByText('A descrição não diz o que vendes.')).toHaveLength(2);
  });

  it('uma pendente com recusas anteriores mostra o histórico debaixo do formulário', async () => {
    api.listApplications.mockResolvedValue([PENDING[0]]);
    api.listStoreDecisions.mockResolvedValue(DECISIONS);
    mount();
    const detail = await detailBox('Doces da Ana');
    const items = await within(detail).findAllByRole('listitem');
    expect(items[0]).toHaveTextContent(/Enviada para análise\./);
    expect(items[1]).toHaveTextContent(/Recusada por Admin J\./);
    expect(within(detail).getByRole('button', { name: 'Aprovar loja' })).toBeInTheDocument();
  });
});
