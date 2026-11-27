import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/ui/sonner';
import { CartButton } from '@/features/catalog/components/CartButton';
import { CatalogSkeleton } from '@/features/catalog/components/CatalogSkeleton';
import { CategoryChips } from '@/features/catalog/components/CategoryChips';
import { EmptyState } from '@/features/catalog/components/EmptyState';
import { NotificationsButton } from '@/features/catalog/components/NotificationsButton';
import { ProductCard } from '@/features/catalog/components/ProductCard';
import { ProductPhoto } from '@/features/catalog/components/ProductPhoto';
import { ApprovedStoreTag, PromotedTag } from '@/features/catalog/components/PromotedTag';
import { ReportLink } from '@/features/catalog/components/ReportLink';
import { SearchField } from '@/features/catalog/components/SearchField';
import { StoreCard } from '@/features/catalog/components/StoreCard';
import { StoreLink } from '@/features/catalog/components/StoreLink';
import type { CatalogProduct, StoreSummary } from '@/features/catalog/types';

const NBSP = ' ';

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Fatia de bolo de chocolate',
    priceKz: 1500,
    stock: 10,
    createdAt: '2020-01-01T00:00:00.000000+00:00',
    storeName: 'Doces da Ana',
    storeSlug: 'doces-da-ana',
    categorySlug: 'doces',
    mainImagePath: null,
    ...overrides,
  };
}

function store(overrides: Partial<StoreSummary> = {}): StoreSummary {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Doces da Ana',
    slug: 'doces-da-ana',
    description: 'Bolos por fatia e encomendas para aniversários.',
    categoryName: 'Doces',
    categorySlug: 'doces',
    logoPath: null,
    productCount: 12,
    rating: null,
    ...overrides,
  };
}

function wrap(ui: ReactNode) {
  return render(
    <MemoryRouter>
      {ui}
      <Toaster />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('ProductCard', () => {
  it('esgotado: etiqueta, preço em ink-muted sem risco e «indisponível» para leitores de ecrã', () => {
    wrap(<ProductCard product={product({ stock: 0 })} />);
    expect(screen.getByText('Esgotado')).toBeInTheDocument();
    const price = screen.getByTestId('product-price');
    expect(price).toHaveClass('text-ink-muted');
    expect(price.className).not.toMatch(/line-through/);
    expect(price.textContent).toContain('indisponível');
  });

  it('com stock 2 mostra «Últimas 2»', () => {
    wrap(<ProductCard product={product({ stock: 2 })} />);
    expect(screen.getByText('Últimas 2')).toBeInTheDocument();
  });

  it('com stock 4 não mostra etiqueta de stock', () => {
    wrap(<ProductCard product={product({ stock: 4 })} />);
    expect(screen.queryByText(/Últimas|Esgotado/)).not.toBeInTheDocument();
  });

  it('formata 1 234 567 Kz com espaços duros', () => {
    wrap(<ProductCard product={product({ priceKz: 1234567 })} />);
    // O jest-dom troca os espaços duros por espaços normais: compara-se o textContent em bruto.
    expect(screen.getByTestId('product-price').textContent).toBe(`1${NBSP}234${NBSP}567${NBSP}Kz`);
  });

  it('o nome é um h3 com ligação para a página do produto', () => {
    wrap(<ProductCard product={product()} />);
    const heading = screen.getByRole('heading', { level: 3, name: 'Fatia de bolo de chocolate' });
    expect(within(heading).getByRole('link')).toHaveAttribute(
      'href',
      '/produto/11111111-1111-1111-1111-111111111111',
    );
  });

  it('o botão de adicionar não está dentro da ligação', () => {
    wrap(<ProductCard product={product()} />);
    const button = screen.getByRole('button', {
      name: 'Adicionar Fatia de bolo de chocolate ao carrinho',
    });
    expect(button.closest('a')).toBeNull();
  });

  it('adicionar mostra «Disponível em breve»', async () => {
    const user = userEvent.setup();
    wrap(<ProductCard product={product()} />);
    await user.click(
      screen.getByRole('button', { name: 'Adicionar Fatia de bolo de chocolate ao carrinho' }),
    );
    expect(await screen.findByText('Disponível em breve')).toBeInTheDocument();
  });

  it('esgotado: o botão está desativado e chama-se «… esgotado»', () => {
    wrap(<ProductCard product={product({ stock: 0 })} />);
    expect(
      screen.getByRole('button', { name: 'Fatia de bolo de chocolate esgotado' }),
    ).toBeDisabled();
  });

  it('mostra «Novo» para um produto criado há menos de 7 dias', () => {
    wrap(<ProductCard product={product({ createdAt: new Date().toISOString() })} />);
    expect(screen.getByText('Novo')).toBeInTheDocument();
  });

  it('mostra a loja só com showStore', () => {
    const { unmount } = wrap(<ProductCard product={product()} />);
    expect(screen.queryByText('Doces da Ana')).not.toBeInTheDocument();
    unmount();
    wrap(<ProductCard product={product()} showStore />);
    expect(screen.getByText('Doces da Ana')).toBeInTheDocument();
  });

  it('um nome de 80 caracteres quebra linha (sem truncate nem nowrap)', () => {
    const name = 'Bolo '.repeat(16).trim().padEnd(80, 'x');
    wrap(<ProductCard product={product({ name })} />);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.className).toMatch(/break-words|wrap-break-word/);
    expect(heading.className).not.toMatch(/truncate|whitespace-nowrap/);
  });
});

describe('ações de fases seguintes', () => {
  it('CartButton mostra «Disponível em breve»', async () => {
    const user = userEvent.setup();
    wrap(<CartButton />);
    await user.click(screen.getByRole('button', { name: 'Carrinho' }));
    expect(await screen.findByText('Disponível em breve')).toBeInTheDocument();
  });

  it('NotificationsButton mostra «Disponível em breve»', async () => {
    const user = userEvent.setup();
    wrap(<NotificationsButton />);
    await user.click(screen.getByRole('button', { name: 'Notificações' }));
    expect(await screen.findByText('Disponível em breve')).toBeInTheDocument();
  });

  it('ReportLink de produto mostra «Disponível em breve»', async () => {
    const user = userEvent.setup();
    wrap(<ReportLink kind="produto" />);
    await user.click(screen.getByRole('button', { name: 'Denunciar produto' }));
    expect(await screen.findByText('Disponível em breve')).toBeInTheDocument();
  });

  it('ReportLink de loja diz «Denunciar loja»', () => {
    wrap(<ReportLink kind="loja" />);
    expect(screen.getByRole('button', { name: 'Denunciar loja' })).toBeInTheDocument();
  });
});

describe('PromotedTag', () => {
  it('sem isPromoted não mostra nada', () => {
    wrap(<PromotedTag isPromoted={false} />);
    expect(screen.queryByText('Promovida')).not.toBeInTheDocument();
  });

  it('com isPromoted mostra «Promovida», sem a classe nem o ícone de «Loja aprovada»', () => {
    wrap(
      <>
        <PromotedTag isPromoted />
        <ApprovedStoreTag />
      </>,
    );
    const promoted = screen.getByText('Promovida');
    const approved = screen.getByText('Loja aprovada');
    const promotedIcon = promoted.querySelector('svg');
    const approvedIcon = approved.querySelector('svg');
    expect(promotedIcon).not.toBeNull();
    expect(approvedIcon).not.toBeNull();
    expect(promotedIcon?.getAttribute('class')).not.toBe(approvedIcon?.getAttribute('class'));
    expect(promoted.className).not.toMatch(/success/);
    expect(approved.className).toMatch(/success/);
  });
});

describe('StoreLink', () => {
  it('sem avaliações diz «Ainda sem avaliações»', () => {
    wrap(<StoreLink store={store()} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/loja/doces-da-ana');
    expect(link).toHaveTextContent('Doces · 12 produtos · Ainda sem avaliações');
  });

  it('com avaliações mostra a média com vírgula', () => {
    wrap(<StoreLink store={store({ rating: { avg: 4.8, count: 23 } })} />);
    expect(screen.getByRole('link')).toHaveTextContent('Doces · 12 produtos · 4,8');
  });
});

describe('StoreCard', () => {
  it('feature: fundo ink, meta e «Ver loja» para a loja', () => {
    wrap(<StoreCard store={store({ rating: { avg: 4.8, count: 3 } })} variant="feature" />);
    const card = screen.getByRole('article');
    expect(card).toHaveAttribute('data-surface', 'ink');
    expect(card).toHaveTextContent('Doces · 12 produtos · 4,8');
    expect(card).toHaveTextContent('DA');
    expect(screen.getByRole('link', { name: 'Ver loja' })).toHaveAttribute(
      'href',
      '/loja/doces-da-ana',
    );
  });

  it('sem avaliações não acrescenta nada à meta', () => {
    wrap(<StoreCard store={store()} variant="feature" />);
    expect(screen.getByRole('article')).toHaveTextContent('Doces · 12 produtos');
    expect(screen.getByRole('article')).not.toHaveTextContent('avaliações');
  });
});

describe('CategoryChips', () => {
  const categories = [
    { id: '1', name: 'Doces', slug: 'doces' },
    { id: '2', name: 'Salgados', slug: 'salgados' },
  ];

  it('com onChange: grupo de botões com aria-pressed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = wrap(
      <CategoryChips
        categories={categories}
        value={null}
        onChange={onChange}
        aria-label="Filtrar por categoria"
      />,
    );
    const group = screen.getByRole('group', { name: 'Filtrar por categoria' });
    expect(within(group).getByRole('button', { name: 'Tudo' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(group).getByRole('button', { name: 'Doces' }));
    expect(onChange).toHaveBeenCalledWith('doces');
    rerender(
      <MemoryRouter>
        <CategoryChips
          categories={categories}
          value="doces"
          onChange={onChange}
          aria-label="Filtrar por categoria"
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Doces' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tudo' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Tudo' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('com hrefFor: nav de ligações com aria-current na ativa e allLabel', () => {
    wrap(
      <CategoryChips
        categories={categories}
        value="salgados"
        hrefFor={(slug) => (slug ? `/explorar?categoria=${slug}` : '/explorar')}
        allLabel="Todas"
        aria-label="Categorias"
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Categorias' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Todas', 'Doces', 'Salgados']);
    expect(links[0]).toHaveAttribute('href', '/explorar');
    expect(links[2]).toHaveAttribute('aria-current', 'true');
    expect(links[0]).not.toHaveAttribute('aria-current');
  });
});

describe('SearchField', () => {
  it('campo de pesquisa controlado com rótulo e enterKeyHint', () => {
    const onChange = vi.fn();
    wrap(
      <SearchField
        label="Pesquisar produtos"
        placeholder="O que te apetece?"
        value="bolo"
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('searchbox', { name: 'Pesquisar produtos' });
    expect(input).toHaveAttribute('type', 'search');
    expect(input).toHaveAttribute('enterkeyhint', 'search');
    expect(input).toHaveAttribute('placeholder', 'O que te apetece?');
    expect(input).toHaveValue('bolo');
    expect(input).toHaveClass('shadow-hard');
    fireEvent.change(input, { target: { value: 'bolos' } });
    expect(onChange).toHaveBeenCalledWith('bolos');
  });
});

describe('ProductPhoto', () => {
  it('sem path não tem img', () => {
    const { container } = wrap(<ProductPhoto path={null} alt="Bolo" />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('com path a img tem o alt, lazy e async', () => {
    wrap(<ProductPhoto path="p/1.webp" alt="Fatia de bolo de chocolate" />);
    const img = screen.getByRole('img', { name: 'Fatia de bolo de chocolate' });
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img.getAttribute('src')).toContain('p/1.webp');
  });
});

describe('EmptyState', () => {
  it('tem role status, título h2, texto e ação opcional', () => {
    wrap(
      <EmptyState
        title="Nada para «pizza»"
        text="Experimenta outra palavra."
        action={<button type="button">Procurar em tudo</button>}
      />,
    );
    const status = screen.getByRole('status');
    expect(within(status).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Nada para «pizza»',
    );
    expect(status).toHaveTextContent('Experimenta outra palavra.');
    expect(within(status).getByRole('button', { name: 'Procurar em tudo' })).toBeInTheDocument();
  });
});

describe('CatalogSkeleton', () => {
  it('anuncia o rótulo e só ao fim de 10 s mostra «Tentar outra vez»', () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    const { container } = render(
      <CatalogSkeleton label="A carregar produtos…" onRetry={onRetry} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('A carregar produtos…');
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/animate-/);
    expect(screen.queryByRole('button', { name: 'Tentar outra vez' })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(9999);
    });
    expect(screen.queryByRole('button', { name: 'Tentar outra vez' })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('Está a demorar.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('limpa o temporizador ao desmontar', () => {
    vi.useFakeTimers();
    const { unmount } = render(<CatalogSkeleton label="A carregar produtos…" onRetry={vi.fn()} />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
