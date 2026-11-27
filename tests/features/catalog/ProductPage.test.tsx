import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/ui/sonner';
import type { ProductDetail } from '@/features/catalog/types';
import { formatKz } from '@/lib/format';
import { renderRoutes } from '../../utils/renderRoutes';

const api = vi.hoisted(() => ({
  listCategories: vi.fn(),
  searchProducts: vi.fn(),
  getProduct: vi.fn(),
  listStores: vi.fn(),
  getStore: vi.fn(),
  listFeaturedStores: vi.fn(),
}));
vi.mock('@/features/catalog/api', () => api);

import { ProductPage } from '@/features/catalog/ProductPage';

const ID = '00000000-0000-0000-0000-000000000001';
const NOTICE =
  'Entrega dentro da universidade: na sala, num ponto de encontro ou a combinar com o vendedor. O pagamento é combinado diretamente com ele.';

function detail(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: ID,
    name: 'Fatia de bolo de chocolate',
    description: 'Fatia generosa.\nFeito no próprio dia.',
    priceKz: 1500,
    stock: 8,
    createdAt: '2020-01-01T00:00:00.000000+00:00',
    categoryName: 'Doces',
    categorySlug: 'doces',
    storeName: 'Doces da Ana',
    storeSlug: 'doces-da-ana',
    storeRating: { avg: 4.8, count: 23 },
    images: [],
    ...overrides,
  };
}

function renderProduct(entries: string[] = [`/produto/${ID}`]) {
  return renderRoutes(
    [
      {
        path: '/produto/:id',
        element: (
          <>
            <ProductPage />
            <Toaster />
          </>
        ),
      },
      { path: '/explorar', element: <p>Página Explorar</p> },
      { path: '/lojas', element: <p>Página Lojas</p> },
      { path: '/loja/:slug', element: <p>Página da loja</p> },
    ],
    entries,
  );
}

async function ready(name = 'Fatia de bolo de chocolate') {
  return screen.findByRole('heading', { level: 1, name });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getProduct.mockResolvedValue(detail());
  window.history.replaceState(null, '');
});

afterEach(() => {
  window.history.replaceState(null, '');
});

describe('ProductPage (C03), conteúdo', () => {
  it('o h1 é o nome, o preço usa formatKz e o título do separador é «<nome> · PAIÁ»', async () => {
    renderProduct();
    await ready();
    expect(api.getProduct).toHaveBeenCalledWith(ID);
    expect(screen.getByTestId('product-price').textContent).toBe(formatKz(1500));
    expect(document.title).toBe('Fatia de bolo de chocolate · PAIÁ');
  });

  it('a categoria é uma etiqueta neutra e aparece «Novo» quando o produto é recente', async () => {
    api.getProduct.mockResolvedValue(detail({ createdAt: new Date().toISOString() }));
    renderProduct();
    await ready();
    expect(screen.getByText('Doces')).toHaveAttribute('data-tag', 'neutral');
    expect(screen.getByText('Novo')).toBeInTheDocument();
  });

  it('sem ser recente, não aparece «Novo»', async () => {
    renderProduct();
    await ready();
    expect(screen.queryByText('Novo')).not.toBeInTheDocument();
  });

  it.each([
    [8, '8 disponíveis'],
    [2, 'Últimas 2'],
    [0, 'Esgotado'],
  ])('com stock %i, mostra «%s»', async (stock, text) => {
    api.getProduct.mockResolvedValue(detail({ stock }));
    renderProduct();
    await ready();
    expect(screen.getByTestId('product-stock')).toHaveTextContent(text);
  });

  it('a ligação da loja diz «Loja aprovada pelo PAIÁ · 4,8 (23 avaliações)» e vai para a loja', async () => {
    renderProduct();
    await ready();
    const link = screen.getByRole('link', { name: /Doces da Ana/ });
    expect(link).toHaveAttribute('href', '/loja/doces-da-ana');
    expect(link).toHaveTextContent('Loja aprovada pelo PAIÁ · 4,8 (23 avaliações)');
  });

  it('com uma avaliação, usa o singular', async () => {
    api.getProduct.mockResolvedValue(detail({ storeRating: { avg: 5, count: 1 } }));
    renderProduct();
    await ready();
    expect(screen.getByRole('link', { name: /Doces da Ana/ })).toHaveTextContent(
      'Loja aprovada pelo PAIÁ · 5,0 (1 avaliação)',
    );
  });

  it('sem avaliações, a ligação da loja diz só «Loja aprovada pelo PAIÁ»', async () => {
    api.getProduct.mockResolvedValue(detail({ storeRating: null }));
    renderProduct();
    await ready();
    const link = screen.getByRole('link', { name: /Doces da Ana/ });
    expect(link).toHaveTextContent('Loja aprovada pelo PAIÁ');
    expect(link).not.toHaveTextContent('avalia');
  });

  it('a secção «Descrição» mostra a descrição, com as quebras de linha', async () => {
    renderProduct();
    await ready();
    const section = screen.getByRole('region', { name: 'Descrição' });
    const text = within(section).getByText(/Fatia generosa\./);
    expect(text.textContent).toBe('Fatia generosa.\nFeito no próprio dia.');
    expect(text).toHaveClass('whitespace-pre-line');
  });

  it('mostra o aviso de entrega com o texto do canvas', async () => {
    renderProduct();
    await ready();
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });

  it('«Denunciar produto» mostra «Disponível em breve»', async () => {
    const user = userEvent.setup({ delay: null });
    renderProduct();
    await ready();
    await user.click(screen.getByRole('button', { name: 'Denunciar produto' }));
    expect(await screen.findByText('Disponível em breve')).toBeInTheDocument();
  });

  it('o cabeçalho tem «Voltar» e o carrinho', async () => {
    const user = userEvent.setup({ delay: null });
    renderProduct();
    await ready();
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
    await user.click(within(header).getByRole('button', { name: 'Carrinho' }));
    expect(await screen.findByText('Disponível em breve')).toBeInTheDocument();
  });

  it('não mostra a navegação inferior, só a barra de compra', async () => {
    renderProduct();
    await ready();
    expect(
      screen.queryByRole('navigation', { name: 'Navegação principal' }),
    ).not.toBeInTheDocument();
  });
});

describe('ProductPage (C03), fotografias', () => {
  const THREE = [
    { path: 'p/c.jpg', position: 2 },
    { path: 'p/a.jpg', position: 0 },
    { path: 'p/b.jpg', position: 1 },
  ];

  it('com 3 imagens, há 3 miniaturas no grupo «Fotos» e a escolhida troca a foto principal', async () => {
    const user = userEvent.setup({ delay: null });
    api.getProduct.mockResolvedValue(detail({ images: THREE }));
    renderProduct();
    await ready();
    const group = screen.getByRole('group', { name: 'Fotos' });
    const thumbs = within(group).getAllByRole('button');
    expect(thumbs.map((b) => b.getAttribute('aria-label'))).toEqual(['Foto 1', 'Foto 2', 'Foto 3']);
    expect(thumbs[0]).toHaveAttribute('aria-current', 'true');

    const main = screen.getByRole('img', { name: 'Fatia de bolo de chocolate, foto 1 de 3' });
    expect(main.getAttribute('src')).toContain('p/a.jpg');

    await user.click(thumbs[1]!);
    expect(thumbs[1]).toHaveAttribute('aria-current', 'true');
    expect(thumbs[0]).not.toHaveAttribute('aria-current');
    const second = screen.getByRole('img', { name: 'Fatia de bolo de chocolate, foto 2 de 3' });
    expect(second.getAttribute('src')).toContain('p/b.jpg');
  });

  it('com 1 imagem, não há miniaturas', async () => {
    api.getProduct.mockResolvedValue(detail({ images: [{ path: 'p/a.jpg', position: 0 }] }));
    renderProduct();
    await ready();
    expect(screen.queryByRole('group', { name: 'Fotos' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Fatia de bolo de chocolate, foto 1 de 1' }),
    ).toBeInTheDocument();
  });

  it('sem imagens, não há miniaturas nem imagem', async () => {
    renderProduct();
    await ready();
    expect(screen.queryByRole('group', { name: 'Fotos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('ProductPage (C03), barra de compra', () => {
  it('a quantidade vai de 1 ao stock, é anunciada e o total acompanha', async () => {
    const user = userEvent.setup({ delay: null });
    api.getProduct.mockResolvedValue(detail({ stock: 2 }));
    renderProduct();
    await ready();
    const qty = screen.getByRole('group', { name: 'Quantidade' });
    const less = within(qty).getByRole('button', { name: 'Diminuir quantidade' });
    const more = within(qty).getByRole('button', { name: 'Aumentar quantidade' });
    const output = within(qty).getByRole('status');
    expect(output.tagName).toBe('OUTPUT');
    expect(output).toHaveAttribute('aria-live', 'polite');
    expect(output).toHaveTextContent('1');
    expect(less).toBeDisabled();
    expect(screen.getByTestId('cta-total').textContent).toBe(`Total: ${formatKz(1500)}`);

    await user.click(more);
    expect(output).toHaveTextContent('2');
    expect(more).toBeDisabled();
    expect(less).toBeEnabled();
    expect(screen.getByTestId('cta-total').textContent).toBe(`Total: ${formatKz(3000)}`);

    await user.click(less);
    expect(output).toHaveTextContent('1');
  });

  it('«Adicionar ao carrinho» mostra «Disponível em breve»', async () => {
    const user = userEvent.setup({ delay: null });
    renderProduct();
    await ready();
    await user.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }));
    expect(await screen.findByText('Disponível em breve')).toBeInTheDocument();
  });

  it('esgotado: sem quantidade e o botão desativado diz «Esgotado»', async () => {
    api.getProduct.mockResolvedValue(detail({ stock: 0 }));
    renderProduct();
    await ready();
    expect(screen.queryByRole('group', { name: 'Quantidade' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar ao carrinho' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Esgotado' })).toBeDisabled();
  });
});

describe('ProductPage (C03), voltar e erros', () => {
  it('com histórico, «Voltar» volta à página anterior', async () => {
    const user = userEvent.setup({ delay: null });
    window.history.replaceState({ idx: 1 }, '');
    renderProduct(['/lojas', `/produto/${ID}`]);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText('Página Lojas')).toBeInTheDocument();
  });

  it('sem histórico, «Voltar» vai para Explorar', async () => {
    const user = userEvent.setup({ delay: null });
    window.history.replaceState({ idx: 0 }, '');
    renderProduct(['/lojas', `/produto/${ID}`]);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText('Página Explorar')).toBeInTheDocument();
  });

  it('um produto que não existe mostra «Não encontrámos o que procuras.» e «Voltar a explorar»', async () => {
    api.getProduct.mockRejectedValue(new Error('Não encontrámos o que procuras.'));
    renderProduct();
    expect(
      await screen.findByRole('heading', { name: 'Não encontrámos o que procuras.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar a explorar' })).toHaveAttribute(
      'href',
      '/explorar',
    );
    expect(screen.queryByRole('button', { name: 'Tentar outra vez' })).not.toBeInTheDocument();
    expect(document.title).toBe('Não encontrado · PAIÁ');
  });

  it('outro erro mostra a mensagem e «Tentar outra vez», que volta a pedir', async () => {
    const user = userEvent.setup({ delay: null });
    api.getProduct.mockRejectedValueOnce(new Error('Sem ligação. Tenta outra vez.'));
    renderProduct();
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem ligação. Tenta outra vez.');
    expect(document.title).toBe('PAIÁ');
    await user.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
    await ready();
    await waitFor(() => expect(api.getProduct).toHaveBeenCalledTimes(2));
  });
});
