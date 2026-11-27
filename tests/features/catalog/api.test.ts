import { beforeEach, describe, expect, it, vi } from 'vitest';

const { order, select, from, rpc } = vi.hoisted(() => {
  const order = vi.fn();
  const select = vi.fn(() => ({ order }));
  return { order, select, from: vi.fn(() => ({ select })), rpc: vi.fn() };
});
vi.mock('@/lib/supabase', () => ({ supabase: { from, rpc } }));

import {
  getProduct,
  getStore,
  listCategories,
  listFeaturedStores,
  listStores,
  searchProducts,
} from '@/features/catalog/api';

beforeEach(() => {
  vi.resetAllMocks();
  select.mockImplementation(() => ({ order }));
  from.mockImplementation(() => ({ select }));
});

const row = (n: number, over: Record<string, unknown> = {}) => ({
  id: `id-${n}`,
  name: `Produto ${n}`,
  price_kz: 1000 * n,
  stock: n,
  created_at: `2026-11-26T10:00:00.12345${n}+00:00`,
  store_name: 'Loja',
  store_slug: 'loja',
  category_slug: 'bolos',
  main_image_path: null,
  ...over,
});

describe('listCategories', () => {
  it('lê só as colunas públicas, por posição', async () => {
    order.mockResolvedValue({ data: [{ id: '1', name: 'Bolos', slug: 'bolos' }], error: null });
    expect(await listCategories()).toEqual([{ id: '1', name: 'Bolos', slug: 'bolos' }]);
    expect(from).toHaveBeenCalledWith('categories');
    expect(select).toHaveBeenCalledWith('id,name,slug');
    expect(order).toHaveBeenCalledWith('position');
  });
  it('traduz o erro e nunca mostra texto técnico', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'relation "x" does not exist' } });
    await expect(listCategories()).rejects.toThrow('Algo correu mal. Tenta outra vez.');
  });
  it('uma rejeição de rede dá a mensagem genérica', async () => {
    order.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(listCategories()).rejects.toThrow('Algo correu mal. Tenta outra vez.');
  });
});

describe('searchProducts', () => {
  it('mapeia snake_case para camelCase', async () => {
    rpc.mockResolvedValue({ data: [row(1, { main_image_path: 'a/b.jpg' })], error: null });
    const r = await searchProducts({ sort: 'recentes' });
    expect(r.items[0]).toEqual({
      id: 'id-1',
      name: 'Produto 1',
      priceKz: 1000,
      stock: 1,
      createdAt: '2026-11-26T10:00:00.123451+00:00',
      storeName: 'Loja',
      storeSlug: 'loja',
      categorySlug: 'bolos',
      mainImagePath: 'a/b.jpg',
    });
  });

  it('passa os filtros e o cursor, com o createdAt em bruto (microssegundos)', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await searchProducts({
      q: 'bolo',
      categorySlug: 'bolos',
      storeSlug: 'loja',
      sort: 'preco-asc',
      limit: 10,
      after: { createdAt: '2026-11-26T10:00:00.123456+00:00', priceKz: 500, id: 'abc' },
    });
    expect(rpc).toHaveBeenCalledWith('search_products', {
      p_q: 'bolo',
      p_category_slug: 'bolos',
      p_store_slug: 'loja',
      p_sort: 'preco-asc',
      p_after_created_at: '2026-11-26T10:00:00.123456+00:00',
      p_after_price: 500,
      p_after_id: 'abc',
      p_limit: 11,
    });
  });

  it('sem filtros não envia cursor nem pesquisa', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await searchProducts({ sort: 'recentes' });
    const args = rpc.mock.calls[0]![1] as Record<string, unknown>;
    expect(args.p_sort).toBe('recentes');
    expect(args.p_after_id).toBeUndefined();
    expect(args.p_q).toBeUndefined();
  });

  it('pede limit + 1 linhas para saber se há mais', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await searchProducts({ sort: 'recentes', limit: 2 });
    expect((rpc.mock.calls[0]![1] as Record<string, unknown>).p_limit).toBe(3);
  });

  it('com a linha extra, devolve `limit` itens e o cursor do último mostrado', async () => {
    rpc.mockResolvedValue({ data: [row(1), row(2), row(3)], error: null });
    const r = await searchProducts({ sort: 'recentes', limit: 2 });
    expect(r.items.map((i) => i.id)).toEqual(['id-1', 'id-2']);
    expect(r.next).toEqual({
      createdAt: '2026-11-26T10:00:00.123452+00:00',
      priceKz: 2000,
      id: 'id-2',
    });
  });

  it('uma última página cheia (exatamente `limit`) não anuncia mais', async () => {
    rpc.mockResolvedValue({ data: [row(1), row(2)], error: null });
    const r = await searchProducts({ sort: 'recentes', limit: 2 });
    expect(r.items).toHaveLength(2);
    expect(r.next).toBeNull();
  });

  it('next é null quando vêm menos de `limit` itens', async () => {
    rpc.mockResolvedValue({ data: [row(1)], error: null });
    expect((await searchProducts({ sort: 'recentes', limit: 2 })).next).toBeNull();
  });

  it('INVALID_CURSOR vira a mensagem PT-AO', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'INVALID_CURSOR' } });
    await expect(searchProducts({ sort: 'recentes' })).rejects.toThrow(
      'Não foi possível carregar mais resultados. Tenta outra vez.',
    );
  });

  it('INVALID_SORT dá a mensagem genérica', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'INVALID_SORT' } });
    await expect(searchProducts({ sort: 'recentes' })).rejects.toThrow(
      'Algo correu mal. Tenta outra vez.',
    );
  });
});

const P1 = '0b7c2f4e-1a2b-4c3d-8e9f-0123456789ab';

const detail = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'Bolo',
  description: 'Bom',
  price_kz: 1500,
  stock: 2,
  created_at: '2026-11-26T10:00:00+00:00',
  category_name: 'Bolos',
  category_slug: 'bolos',
  store_name: 'Loja',
  store_slug: 'loja',
  store_rating_avg: '4.50',
  store_rating_count: 3,
  images: [{ path: 'p1/a.jpg', position: 0 }],
  ...over,
});

describe('getProduct', () => {
  it('sem linhas, lança «Não encontrámos o que procuras.»', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(getProduct(P1)).rejects.toThrow('Não encontrámos o que procuras.');
    expect(rpc).toHaveBeenCalledWith('get_product', { p_id: P1 });
  });

  it('um id que não é uuid dá «não encontrado» sem chamar a base', async () => {
    for (const bad of ['123', 'x', '', `${P1}0`, 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz']) {
      await expect(getProduct(bad)).rejects.toThrow('Não encontrámos o que procuras.');
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('o 22P02 do Postgres (sintaxe inválida) vira «não encontrado»', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '22P02', message: 'invalid input syntax for type uuid: "123"' },
    });
    await expect(getProduct(P1)).rejects.toThrow('Não encontrámos o que procuras.');
  });

  it('converte a avaliação (texto numérico) em número', async () => {
    rpc.mockResolvedValue({ data: [detail()], error: null });
    const p = await getProduct(P1);
    expect(p.storeRating).toEqual({ avg: 4.5, count: 3 });
    expect(p.images).toEqual([{ path: 'p1/a.jpg', position: 0 }]);
  });

  it('storeRating é null quando não há avaliações', async () => {
    rpc.mockResolvedValue({
      data: [detail({ store_rating_avg: null, store_rating_count: 0 })],
      error: null,
    });
    expect((await getProduct(P1)).storeRating).toBeNull();
  });

  it('aceita categoria escondida e imagens em falta', async () => {
    rpc.mockResolvedValue({
      data: [detail({ category_name: null, category_slug: null, images: null })],
      error: null,
    });
    const p = await getProduct(P1);
    expect(p.categoryName).toBeNull();
    expect(p.categorySlug).toBeNull();
    expect(p.images).toEqual([]);
  });
});

const storeRow = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  name: 'Loja',
  slug: 'loja',
  description: null,
  category_name: null,
  category_slug: null,
  logo_path: null,
  published_products_count: 4,
  rating_avg: null,
  rating_count: 0,
  ...over,
});

describe('listStores', () => {
  it('mapeia e usa null para o que falta', async () => {
    rpc.mockResolvedValue({ data: [storeRow()], error: null });
    const r = await listStores({ q: 'lo', categorySlug: 'bolos' });
    expect(rpc).toHaveBeenCalledWith('list_stores', { p_q: 'lo', p_category_slug: 'bolos' });
    expect(r[0]).toEqual({
      id: 's1',
      name: 'Loja',
      slug: 'loja',
      description: null,
      categoryName: null,
      categorySlug: null,
      logoPath: null,
      productCount: 4,
      rating: null,
    });
  });

  it('rating com média em texto', async () => {
    rpc.mockResolvedValue({
      data: [storeRow({ rating_avg: '3.8', rating_count: 5 })],
      error: null,
    });
    expect((await listStores({}))[0]!.rating).toEqual({ avg: 3.8, count: 5 });
  });
});

describe('getStore', () => {
  it('sem linhas, lança «Não encontrámos o que procuras.»', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(getStore('x')).rejects.toThrow('Não encontrámos o que procuras.');
    expect(rpc).toHaveBeenCalledWith('get_store', { p_slug: 'x' });
  });

  it('inclui as categorias dos produtos', async () => {
    rpc.mockResolvedValue({
      data: [storeRow({ product_categories: [{ name: 'Bolos', slug: 'bolos' }] })],
      error: null,
    });
    expect((await getStore('loja')).productCategories).toEqual([{ name: 'Bolos', slug: 'bolos' }]);
  });

  it('product_categories em falta dá lista vazia', async () => {
    rpc.mockResolvedValue({ data: [storeRow({ product_categories: null })], error: null });
    expect((await getStore('loja')).productCategories).toEqual([]);
  });
});

describe('listFeaturedStores', () => {
  it('source paid é promovida; admin não', async () => {
    rpc.mockResolvedValue({
      data: [storeRow({ id: 'a', source: 'paid' }), storeRow({ id: 'b', source: 'admin' })],
      error: null,
    });
    const r = await listFeaturedStores();
    expect(rpc).toHaveBeenCalledWith('list_featured_stores');
    expect(r.map((s) => s.isPromoted)).toEqual([true, false]);
  });
});
