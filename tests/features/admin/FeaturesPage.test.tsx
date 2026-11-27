import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminFeature } from '@/features/admin/types';
import type { StoreSummary } from '@/features/catalog/types';

const api = vi.hoisted(() => ({
  FEATURES_CHANGED: 'A lista mudou. Atualizámos a ordem; tenta outra vez.',
  listFeatures: vi.fn(),
  saveFeature: vi.fn(),
  setFeatureActive: vi.fn(),
  removeFeature: vi.fn(),
  reorderFeatures: vi.fn(),
}));
vi.mock('@/features/admin/api', () => api);

const catalog = vi.hoisted(() => ({
  listCategories: vi.fn(async () => []),
  searchProducts: vi.fn(async () => ({ items: [], next: null })),
  getProduct: vi.fn(),
  listStores: vi.fn(),
  getStore: vi.fn(),
  listFeaturedStores: vi.fn(async () => []),
}));
vi.mock('@/features/catalog/api', () => catalog);

// Sessão observável: mudar de conta volta a desenhar quem usa useAuth, como no AuthProvider.
const auth = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const store = {
    state: { session: { user: { id: 'admin-1' } } as unknown, loading: false },
    set(next: { session: unknown; loading: boolean }) {
      store.state = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return store;
});
vi.mock('@/features/auth/AuthProvider', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useAuth: () => useSyncExternalStore(auth.subscribe, () => auth.state),
    currentUserId: () => (auth.state.session as { user: { id: string } } | null)?.user.id ?? null,
  };
});

const toast = vi.hoisted(() => vi.fn());
vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast,
}));

import { FeaturesPage } from '@/features/admin/FeaturesPage';
import { renderRoutes } from '../../utils/renderRoutes';

function feature(over: Partial<AdminFeature> & Pick<AdminFeature, 'id' | 'storeName'>) {
  return {
    storeId: `loja-${over.id}`,
    storeSlug: `loja-${over.id}`,
    storeStatus: 'approved',
    source: 'admin',
    position: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
    note: null,
    isLive: false,
    ...over,
  } satisfies AdminFeature;
}

const FEATURES: AdminFeature[] = [
  feature({ id: 'a', storeName: 'Doces da Ana', position: 0, isLive: true }),
  feature({
    id: 'b',
    storeName: 'Gelados Fresquinhos',
    position: 1,
    startsAt: '2099-01-01T10:00:00+01:00',
  }),
  feature({
    id: 'c',
    storeName: 'Mimos da Teresa',
    position: 2,
    endsAt: '2000-01-01T10:00:00+01:00',
  }),
  feature({ id: 'd', storeName: 'Acessórios do Kiko', position: 3, isActive: false }),
];

const SALGADOS: StoreSummary = {
  id: 'loja-salgados',
  name: 'Salgados do Bloco',
  slug: 'salgados-do-bloco',
  description: null,
  categoryName: null,
  categorySlug: null,
  logoPath: null,
  productCount: 3,
  rating: null,
};

function mount() {
  return renderRoutes(
    [{ path: '/admin/destaques', element: <FeaturesPage /> }],
    '/admin/destaques',
  );
}

function rowOf(storeName: string) {
  const row = screen.getByRole('link', { name: storeName }).closest('tr');
  if (!row) throw new Error(`sem linha para ${storeName}`);
  return row;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.set({ session: { user: { id: 'admin-1' } }, loading: false });
  api.listFeatures.mockResolvedValue(FEATURES);
  catalog.listStores.mockResolvedValue([SALGADOS]);
});

describe('FeaturesPage (A07), lista', () => {
  it('tem o título, a navegação da administração e o texto de introdução', async () => {
    mount();
    expect(await screen.findByRole('heading', { level: 1, name: 'Destaques' })).toBeInTheDocument();
    expect(document.title).toBe('Destaques · Administração · PAIÁ');
    const nav = screen.getByRole('navigation', { name: 'Administração' });
    expect(within(nav).getByRole('link', { name: 'Destaques' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByText(
        'Escolhe as lojas que aparecem em «Lojas da comunidade», na página inicial. A ordem desta lista é a ordem no Início. Só lojas aprovadas podem estar em destaque.',
      ),
    ).toBeInTheDocument();
  });

  it('mostra o estado de cada destaque e a origem «Administração»', async () => {
    mount();
    await screen.findByRole('link', { name: 'Doces da Ana' });
    expect(within(rowOf('Doces da Ana')).getByText('No ar')).toBeInTheDocument();
    expect(within(rowOf('Gelados Fresquinhos')).getByText('Agendado')).toBeInTheDocument();
    expect(within(rowOf('Mimos da Teresa')).getByText('Expirado')).toBeInTheDocument();
    expect(within(rowOf('Acessórios do Kiko')).getByText('Desligado')).toBeInTheDocument();
    for (const name of ['Doces da Ana', 'Gelados Fresquinhos', 'Acessórios do Kiko']) {
      expect(within(rowOf(name)).getByText('Administração')).toBeInTheDocument();
    }
    expect(within(rowOf('Doces da Ana')).getByText('Sem datas')).toBeInTheDocument();
    expect(within(rowOf('Mimos da Teresa')).getByText(/^Terminou em /)).toBeInTheDocument();
    expect(within(rowOf('Gelados Fresquinhos')).getByText(/^De /)).toBeInTheDocument();
    expect(screen.getByText('No ar: pode aparecer no Início (até 10 lojas).')).toBeInTheDocument();
  });

  it('um destaque pago, se aparecer, diz «Promoção paga» na origem', async () => {
    api.listFeatures.mockResolvedValue([
      feature({ id: 'p', storeName: 'Loja Paga', source: 'paid', isLive: true }),
    ]);
    mount();
    await screen.findByRole('link', { name: 'Loja Paga' });
    expect(within(rowOf('Loja Paga')).getByText('Promoção paga')).toBeInTheDocument();
  });

  it('a loja liga à sua página pública', async () => {
    mount();
    expect(await screen.findByRole('link', { name: 'Doces da Ana' })).toHaveAttribute(
      'href',
      '/loja/loja-a',
    );
  });

  it('sem destaques, diz o que fazer', async () => {
    api.listFeatures.mockResolvedValue([]);
    mount();
    expect(
      await screen.findByText('Ainda não há lojas em destaque. Adiciona a primeira.'),
    ).toBeInTheDocument();
  });

  it('se a lista não carregar, mostra o erro e permite tentar outra vez', async () => {
    const user = userEvent.setup({ delay: null });
    api.listFeatures.mockRejectedValueOnce(new Error('Não tens permissão para fazer isto.'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não tens permissão para fazer isto.',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(await screen.findByRole('link', { name: 'Doces da Ana' })).toBeInTheDocument();
  });
});

describe('FeaturesPage (A07), estado com a página aberta', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('o estado muda sozinho quando o fim passa, com a página aberta (60 s)', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-12-01T10:00:00+01:00'));
    api.listFeatures.mockResolvedValue([
      feature({
        id: 'z',
        storeName: 'Fim Próximo',
        isLive: true,
        endsAt: '2026-12-01T10:00:30+01:00',
      }),
    ]);
    mount();
    await screen.findByRole('link', { name: 'Fim Próximo' });
    expect(within(rowOf('Fim Próximo')).getByText('No ar')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(within(rowOf('Fim Próximo')).getByText('No ar')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(within(rowOf('Fim Próximo')).getByText('Expirado')).toBeInTheDocument();
  });
});

describe('FeaturesPage (A07), adicionar', () => {
  async function openForm() {
    const user = userEvent.setup({ delay: null });
    mount();
    await user.click(await screen.findByRole('button', { name: 'Adicionar destaque' }));
    const form = screen.getByRole('region', { name: 'Adicionar destaque' });
    return { user, form };
  }

  it('abre o formulário com a origem «Administração» e «Promoção paga» desativada', async () => {
    const { form } = await openForm();
    expect(within(form).getByLabelText('Loja')).toHaveFocus();
    expect(within(form).getByText('Só aparecem lojas aprovadas.')).toBeInTheDocument();
    expect(within(form).getByRole('radio', { name: 'Administração' })).toBeChecked();
    expect(within(form).getByRole('radio', { name: 'Promoção paga' })).toBeDisabled();
    expect(within(form).getByText('Promoção paga: disponível em breve.')).toBeInTheDocument();
    expect(
      within(form).getByText('Sem datas, o destaque fica no ar até o desligares ou removeres.'),
    ).toBeInTheDocument();
    expect(
      within(form).getByText('Só a equipa da administração vê esta nota.'),
    ).toBeInTheDocument();
  });

  it('pesquisa lojas com listStores({ q }) e, ao guardar, chama saveFeature e confirma', async () => {
    const { user, form } = await openForm();
    api.saveFeature.mockResolvedValue('novo');
    await user.type(within(form).getByLabelText('Loja'), 'Salg');
    await user.click(await within(form).findByRole('radio', { name: 'Salgados do Bloco' }));
    expect(catalog.listStores).toHaveBeenCalledWith({ q: 'Salg' });
    await user.type(within(form).getByLabelText('Nota interna (opcional)'), '  Feira de dezembro ');
    await user.click(within(form).getByRole('button', { name: 'Guardar destaque' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Destaque guardado.'));
    expect(api.saveFeature).toHaveBeenCalledWith({
      storeId: 'loja-salgados',
      // A posição é a da base (fim da ordem), para duas criações ao mesmo tempo não colidirem.
      position: null,
      startsAt: null,
      endsAt: null,
      note: 'Feira de dezembro',
    });
    expect(screen.queryByRole('region', { name: 'Adicionar destaque' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Adicionar destaque' })).toHaveFocus();
  });

  it('envia as datas em hora de Luanda, com o fuso', async () => {
    const { user, form } = await openForm();
    api.saveFeature.mockResolvedValue('novo');
    await user.type(within(form).getByLabelText('Loja'), 'Salg');
    await user.click(await within(form).findByRole('radio', { name: 'Salgados do Bloco' }));
    fireEvent.change(within(form).getByLabelText('Início (opcional)'), {
      target: { value: '2026-12-01T10:00' },
    });
    fireEvent.change(within(form).getByLabelText('Fim (opcional)'), {
      target: { value: '2026-12-24T18:30' },
    });
    await user.click(within(form).getByRole('button', { name: 'Guardar destaque' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Destaque guardado.'));
    expect(api.saveFeature).toHaveBeenCalledWith(
      expect.objectContaining({
        startsAt: '2026-12-01T10:00:00+01:00',
        endsAt: '2026-12-24T18:30:00+01:00',
      }),
    );
  });

  it('com o fim antes do início, avisa junto ao campo e não chama a API', async () => {
    const { user, form } = await openForm();
    await user.type(within(form).getByLabelText('Loja'), 'Salg');
    await user.click(await within(form).findByRole('radio', { name: 'Salgados do Bloco' }));
    fireEvent.change(within(form).getByLabelText('Início (opcional)'), {
      target: { value: '2026-12-02T10:00' },
    });
    const end = within(form).getByLabelText('Fim (opcional)');
    fireEvent.change(end, { target: { value: '2026-12-01T10:00' } });
    await user.click(within(form).getByRole('button', { name: 'Guardar destaque' }));
    expect(end).toHaveAttribute('aria-invalid', 'true');
    expect(end).toHaveAccessibleDescription('A data de fim tem de ser depois da data de início.');
    expect(end).toHaveFocus();
    expect(api.saveFeature).not.toHaveBeenCalled();
  });

  it('sem loja escolhida, pede uma e não chama a API', async () => {
    const { user, form } = await openForm();
    await user.click(within(form).getByRole('button', { name: 'Guardar destaque' }));
    const search = within(form).getByLabelText('Loja');
    expect(search).toHaveAttribute('aria-invalid', 'true');
    expect(search).toHaveAccessibleDescription(
      expect.stringContaining('Escolhe uma loja da lista.'),
    );
    expect(api.saveFeature).not.toHaveBeenCalled();
  });

  it('conta os caracteres da nota e recusa mais de 280', async () => {
    const { user, form } = await openForm();
    await user.type(within(form).getByLabelText('Loja'), 'Salg');
    await user.click(await within(form).findByRole('radio', { name: 'Salgados do Bloco' }));
    const note = within(form).getByLabelText('Nota interna (opcional)');
    await user.click(note);
    await user.paste('x'.repeat(281));
    expect(within(form).getByText('281 de 280 caracteres')).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Guardar destaque' }));
    expect(note).toHaveAttribute('aria-invalid', 'true');
    expect(note).toHaveAccessibleDescription(
      expect.stringContaining('A nota pode ter até 280 caracteres.'),
    );
    expect(api.saveFeature).not.toHaveBeenCalled();
  });

  it('o erro FEATURE_EXISTS da API aparece num alerta', async () => {
    const { user, form } = await openForm();
    api.saveFeature.mockRejectedValue(new Error('Esta loja já está em destaque.'));
    await user.type(within(form).getByLabelText('Loja'), 'Salg');
    await user.click(await within(form).findByRole('radio', { name: 'Salgados do Bloco' }));
    await user.click(within(form).getByRole('button', { name: 'Guardar destaque' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Esta loja já está em destaque.',
    );
    expect(toast).not.toHaveBeenCalled();
  });

  it('se a sessão mudar enquanto guarda, não mostra «Destaque guardado.» ao utilizador seguinte', async () => {
    const { user, form } = await openForm();
    let finish: (id: string) => void = () => {};
    api.saveFeature.mockImplementation(() => new Promise<string>((r) => (finish = r)));
    await user.type(within(form).getByLabelText('Loja'), 'Salg');
    await user.click(await within(form).findByRole('radio', { name: 'Salgados do Bloco' }));
    await user.click(within(form).getByRole('button', { name: 'Guardar destaque' }));
    await waitFor(() => expect(api.saveFeature).toHaveBeenCalled());
    act(() => auth.set({ session: { user: { id: 'outra-pessoa' } }, loading: false }));
    finish('novo');
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Adicionar destaque' })).toBeNull(),
    );
    expect(toast).not.toHaveBeenCalled();
  });

  it('Cancelar fecha o formulário e devolve o foco a «Adicionar destaque»', async () => {
    const { user, form } = await openForm();
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('region', { name: 'Adicionar destaque' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Adicionar destaque' })).toHaveFocus();
  });
});

describe('FeaturesPage (A07), ordem e estado', () => {
  it('as setas nas pontas estão desativadas; um destaque desligado não tem ordem', async () => {
    mount();
    await screen.findByRole('link', { name: 'Doces da Ana' });
    expect(screen.getByRole('button', { name: 'Subir Doces da Ana' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Descer Mimos da Teresa' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    // Um destaque desligado não entra na ordem: sem setas, só «— Sem ordem».
    expect(screen.queryByRole('button', { name: 'Subir Acessórios do Kiko' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Descer Acessórios do Kiko' })).toBeNull();
    expect(within(rowOf('Acessórios do Kiko')).getByText('Sem ordem')).toBeInTheDocument();
  });

  it('«Subir» no segundo envia a lista completa dos ativos pela nova ordem; o foco fica no botão', async () => {
    const user = userEvent.setup({ delay: null });
    // Como a base: depois de ordenar, a lista volta pela nova ordem.
    api.reorderFeatures.mockImplementation(async (ids: string[]) => {
      api.listFeatures.mockResolvedValue([
        ...ids.map((id, i) => ({ ...FEATURES.find((f) => f.id === id)!, position: i })),
        ...FEATURES.filter((f) => !f.isActive),
      ]);
    });
    mount();
    await user.click(await screen.findByRole('button', { name: 'Subir Gelados Fresquinhos' }));
    await waitFor(() => expect(api.reorderFeatures).toHaveBeenCalledWith(['b', 'a', 'c']));
    const moved = screen.getByRole('button', { name: 'Subir Gelados Fresquinhos' });
    await waitFor(() => expect(moved).toHaveFocus());
    expect(moved).toHaveAttribute('aria-disabled', 'true');
    await waitFor(() => expect(api.listFeatures).toHaveBeenCalledTimes(2));
  });

  it('«Descer» move para baixo', async () => {
    const user = userEvent.setup({ delay: null });
    api.reorderFeatures.mockResolvedValue(undefined);
    mount();
    await user.click(await screen.findByRole('button', { name: 'Descer Gelados Fresquinhos' }));
    await waitFor(() => expect(api.reorderFeatures).toHaveBeenCalledWith(['a', 'c', 'b']));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Descer Gelados Fresquinhos' })).toHaveFocus(),
    );
    await waitFor(() => expect(api.listFeatures).toHaveBeenCalledTimes(2));
  });

  it('uma seta desativada não faz nada', async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    await user.click(await screen.findByRole('button', { name: 'Subir Doces da Ana' }));
    expect(api.reorderFeatures).not.toHaveBeenCalled();
  });

  it('com a lista desatualizada, atualiza a lista e avisa num alerta', async () => {
    const user = userEvent.setup({ delay: null });
    api.reorderFeatures.mockRejectedValue(new Error(api.FEATURES_CHANGED));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Subir Gelados Fresquinhos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A lista mudou. Atualizámos a ordem; tenta outra vez.',
    );
    await waitFor(() => expect(api.listFeatures).toHaveBeenCalledTimes(2));
  });

  it('o interruptor «Ativo» é um switch e chama setFeatureActive', async () => {
    const user = userEvent.setup({ delay: null });
    api.setFeatureActive.mockResolvedValue(undefined);
    mount();
    const on = await screen.findByRole('switch', { name: 'Destaque de Doces da Ana ativo' });
    expect(on).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('switch', { name: 'Destaque de Acessórios do Kiko ativo' }),
    ).toHaveAttribute('aria-checked', 'false');
    await user.click(on);
    await waitFor(() => expect(api.setFeatureActive).toHaveBeenCalledWith('a', false));
    await waitFor(() => expect(api.listFeatures).toHaveBeenCalledTimes(2));
  });

  it('depois de desligar, a linha passa para o fim e o foco fica no interruptor dela', async () => {
    const user = userEvent.setup({ delay: null });
    // Como a base: desligado, sai da ordem e aparece com os desligados, no fim.
    api.setFeatureActive.mockImplementation(async (id: string, active: boolean) => {
      const moved = { ...FEATURES.find((f) => f.id === id)!, isActive: active, isLive: false };
      api.listFeatures.mockResolvedValue([...FEATURES.filter((f) => f.id !== id), moved]);
    });
    mount();
    await user.click(await screen.findByRole('switch', { name: 'Destaque de Doces da Ana ativo' }));
    await waitFor(() => expect(api.listFeatures).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(within(rowOf('Doces da Ana')).getByText('Desligado')).toBeInTheDocument(),
    );
    const rows = screen.getAllByRole('row');
    expect(rows[rows.length - 1]).toBe(rowOf('Doces da Ana'));
    const sw = screen.getByRole('switch', { name: 'Destaque de Doces da Ana ativo' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await waitFor(() => expect(sw).toHaveFocus());
  });

  it('depois de ligar, o foco fica no interruptor da linha que voltou à ordem', async () => {
    const user = userEvent.setup({ delay: null });
    api.setFeatureActive.mockImplementation(async (id: string, active: boolean) => {
      const moved = { ...FEATURES.find((f) => f.id === id)!, isActive: active, position: 4 };
      api.listFeatures.mockResolvedValue([...FEATURES.filter((f) => f.isActive), moved]);
    });
    mount();
    await user.click(
      await screen.findByRole('switch', { name: 'Destaque de Acessórios do Kiko ativo' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Subir Acessórios do Kiko' })).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('switch', { name: 'Destaque de Acessórios do Kiko ativo' }),
      ).toHaveFocus(),
    );
  });

  it('se ligar falhar, mostra o erro num alerta', async () => {
    const user = userEvent.setup({ delay: null });
    api.setFeatureActive.mockRejectedValue(new Error('Esta loja não está aprovada.'));
    mount();
    await user.click(
      await screen.findByRole('switch', { name: 'Destaque de Acessórios do Kiko ativo' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta loja não está aprovada.');
  });
});

describe('FeaturesPage (A07), remover', () => {
  it('pede confirmação e só depois chama removeFeature', async () => {
    const user = userEvent.setup({ delay: null });
    api.removeFeature.mockResolvedValue(undefined);
    mount();
    const trigger = await screen.findByRole('button', { name: 'Remover Gelados Fresquinhos' });

    await user.click(trigger);
    let dialog = screen.getByRole('alertdialog', {
      name: 'Remover destaque de Gelados Fresquinhos?',
    });
    expect(dialog).toHaveAccessibleDescription(
      'A loja deixa de aparecer em «Lojas da comunidade». A loja e os produtos não mudam. Podes voltar a pô-la em destaque quando quiseres.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(api.removeFeature).not.toHaveBeenCalled();

    await user.click(trigger);
    dialog = screen.getByRole('alertdialog', { name: 'Remover destaque de Gelados Fresquinhos?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remover destaque' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Destaque removido.'));
    expect(api.removeFeature).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(api.listFeatures).toHaveBeenCalledTimes(2));
  });

  it('se a sessão mudar enquanto remove, não mostra «Destaque removido.»', async () => {
    const user = userEvent.setup({ delay: null });
    let finish: () => void = () => {};
    api.removeFeature.mockImplementation(() => new Promise<void>((r) => (finish = r)));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Remover Doces da Ana' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remover destaque' }),
    );
    await waitFor(() => expect(api.removeFeature).toHaveBeenCalled());
    act(() => auth.set({ session: { user: { id: 'outra-pessoa' } }, loading: false }));
    finish();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(toast).not.toHaveBeenCalled();
  });

  it('se remover falhar, o erro aparece dentro da confirmação', async () => {
    const user = userEvent.setup({ delay: null });
    api.removeFeature.mockRejectedValue(new Error('Não encontrámos o que procuras.'));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Remover Doces da Ana' }));
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remover destaque' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não encontrámos o que procuras.',
    );
  });
});
