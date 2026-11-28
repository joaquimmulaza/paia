import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateTime } from '@/lib/format';

const sellerApi = vi.hoisted(() => ({
  getMyStore: vi.fn(),
  getMyStoreDecisions: vi.fn(),
}));
vi.mock('@/features/seller/api', () => sellerApi);
const catalogApi = vi.hoisted(() => ({ listCategories: vi.fn() }));
vi.mock('@/features/catalog/api', () => catalogApi);

import { StoreRequestViewPage } from '@/features/seller/StoreRequestViewPage';
import { StoreStatusPage } from '@/features/seller/StoreStatusPage';
import { renderRoutes } from '../../utils/renderRoutes';
import { CATEGORIES, makeStore } from './fixtures';

const SUBMITTED = '2026-11-28T09:02:00.000000+00:00';

function mount(path: string) {
  return renderRoutes(
    [
      { path: '/vender', element: <p>Quero vender</p> },
      { path: '/vender/pedido', element: <p>Formulário</p> },
      { path: '/vender/estado', element: <StoreStatusPage /> },
      { path: '/vender/pedido/ver', element: <StoreRequestViewPage /> },
      { path: '/vender/loja', element: <p>Painel</p> },
    ],
    path,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  catalogApi.listCategories.mockResolvedValue(CATEGORIES);
  sellerApi.getMyStoreDecisions.mockResolvedValue([]);
});

describe('StoreStatusPage (V03)', () => {
  it('em análise: «Recebemos o teu pedido», a data do envio e «Ver o pedido»', async () => {
    sellerApi.getMyStore.mockResolvedValue(
      makeStore({ kind: 'pending', status: 'pending_approval', submittedAt: SUBMITTED }),
    );
    mount('/vender/estado');
    expect(await screen.findByText('Recebemos o teu pedido')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'A minha loja' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Doces da Ana' })).toHaveTextContent('Em análise');
    expect(
      screen.getByText(`${formatDateTime(SUBMITTED)} · Pedido enviado para análise.`),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver o pedido' })).toHaveAttribute(
      'href',
      '/vender/pedido/ver',
    );
  });

  it('recusada: mostra a mensagem da equipa e «Corrigir e enviar»', async () => {
    sellerApi.getMyStore.mockResolvedValue(
      makeStore({
        kind: 'rejected',
        status: 'rejected',
        lastMessage: 'A descrição não diz o que vendes.',
      }),
    );
    mount('/vender/estado');
    expect(await screen.findByText('A loja ainda não foi aprovada')).toBeInTheDocument();
    expect(screen.getByText('Recusada')).toBeInTheDocument();
    expect(screen.getByText(/Mensagem da equipa:/).closest('p')).toHaveTextContent(
      'Mensagem da equipa: A descrição não diz o que vendes.',
    );
    expect(screen.getByRole('link', { name: 'Corrigir e enviar' })).toHaveAttribute(
      'href',
      '/vender/pedido',
    );
  });

  it('suspensa: mostra o aviso, sem ação', async () => {
    sellerApi.getMyStore.mockResolvedValue(makeStore({ kind: 'suspended', status: 'suspended' }));
    mount('/vender/estado');
    expect(
      await screen.findByText('A tua loja está suspensa. Fala com a equipa do PAIÁ.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Suspensa')).toBeInTheDocument();
  });

  it.each([
    ['none', 'Quero vender'],
    ['draft', 'Formulário'],
    ['approved', 'Painel'],
  ] as const)('com %s, vai para outro ecrã', async (kind, text) => {
    sellerApi.getMyStore.mockResolvedValue(kind === 'none' ? null : makeStore({ kind }));
    mount('/vender/estado');
    expect(await screen.findByText(text)).toBeInTheDocument();
  });
});

describe('StoreRequestViewPage (V03b)', () => {
  it('mostra o pedido como vai aparecer, o aviso da análise e o histórico', async () => {
    sellerApi.getMyStore.mockResolvedValue(
      makeStore({ kind: 'pending', status: 'pending_approval', submittedAt: SUBMITTED }),
    );
    mount('/vender/pedido/ver');
    expect(
      await screen.findByText(
        'Durante a análise não podes mudar o pedido. Se for recusado, corriges e envias outra vez.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'O teu pedido' })).toBeVisible();
    expect(screen.getByRole('banner')).toHaveTextContent('Em análise');
    const card = screen.getByRole('region', { name: 'Como a loja vai aparecer' });
    expect(card).toHaveTextContent('…/loja/doces-da-ana');
    expect(card).toHaveTextContent('Bolos por fatia e encomendas para aniversários.');
    expect(await screen.findByText('Doces')).toBeInTheDocument();
    expect(card).toHaveTextContent('Sem capa');
    const history = screen.getByRole('region', { name: 'Histórico' });
    const items = history.querySelectorAll('li');
    expect(items[0]).toHaveTextContent(`${formatDateTime(SUBMITTED)} · Enviado para análise.`);
    expect(items[1]).toHaveTextContent(
      `${formatDateTime('2026-11-27T20:40:00.000000+00:00')} · Rascunho guardado.`,
    );
  });

  it('o histórico mostra a recusa e a mensagem, sem o nome de quem decidiu', async () => {
    sellerApi.getMyStore.mockResolvedValue(
      makeStore({
        kind: 'rejected',
        status: 'rejected',
        submittedAt: '2026-11-28T08:00:00.000000+00:00',
        lastMessage: 'Falta a descrição.',
      }),
    );
    sellerApi.getMyStoreDecisions.mockResolvedValue([
      { decision: 'rejected', message: 'Falta a descrição.', createdAt: SUBMITTED },
    ]);
    mount('/vender/pedido/ver');
    const history = await screen.findByRole('region', { name: 'Histórico' });
    expect(await screen.findByText(/Recusado pela equipa/)).toBeInTheDocument();
    const items = history.querySelectorAll('li');
    expect(items[0]).toHaveTextContent('Recusado pela equipa.');
    expect(items[0]).toHaveTextContent('Falta a descrição.');
    expect(
      screen.queryByText('Durante a análise não podes mudar o pedido.', { exact: false }),
    ).toBeNull();
  });
});
