import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = { results: [] as unknown[], calls: [] as { table: string; ops: unknown[][] }[] };
  const rpc = vi.fn();
  const upload = vi.fn();
  const remove = vi.fn();
  const storageFrom = vi.fn();
  function from(table: string) {
    const entry = { table, ops: [] as unknown[][] };
    state.calls.push(entry);
    const chain: Record<string, unknown> = {};
    for (const m of [
      'select',
      'insert',
      'update',
      'delete',
      'eq',
      'or',
      'order',
      'limit',
      'single',
      'maybeSingle',
    ]) {
      chain[m] = (...args: unknown[]) => {
        entry.ops.push([m, ...args]);
        return chain;
      };
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(state.results.shift() ?? { data: null, error: null }).then(res, rej);
    return chain;
  }
  return { state, rpc, upload, remove, storageFrom, from };
});
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
    storage: { from: mocks.storageFrom },
  },
}));

import {
  countMyProducts,
  createProduct,
  deleteProduct,
  getMyProduct,
  getMyStore,
  getMyStoreDecisions,
  listMyProducts,
  removeProductImage,
  saveMyStore,
  setProductImageOrder,
  submitMyStore,
  updateProduct,
  uploadProductImage,
  uploadStoreImage,
} from '@/features/seller/api';
import { MESSAGES, translateDbError } from '@/lib/errors';

interface Result {
  data?: unknown;
  count?: number | null;
  error?: { message: string; code?: string } | null;
}

function queue(...results: Result[]) {
  mocks.state.results.push(...results);
}
const ops = (i = 0) => mocks.state.calls[i]!.ops;
const op = (name: string, i = 0) => ops(i).find((o) => o[0] === name);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.state.results = [];
  mocks.state.calls = [];
  mocks.storageFrom.mockImplementation(() => ({ upload: mocks.upload, remove: mocks.remove }));
});

const storeRow = {
  id: 's1',
  name: 'Doces da Ana',
  slug: 'doces-da-ana',
  description: 'Bolos',
  category_id: 'c1',
  logo_path: 'stores/s1/logo-x.webp',
  cover_path: null,
  status: 'rejected',
  submitted_at: '2026-11-28T10:00:00.123456+00:00',
  decided_at: null,
  created_at: '2026-11-20T10:00:00+00:00',
  published_products_count: 3,
  hidden_products_count: 1,
  sold_out_products_count: 2,
  last_message: 'Junta um logótipo mais nítido.',
};

describe('getMyStore', () => {
  it('sem loja devolve null', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await getMyStore()).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith('get_my_store');
  });

  it('converte para camelCase e mostra a mensagem quando está rejeitada', async () => {
    mocks.rpc.mockResolvedValue({ data: [storeRow], error: null });
    expect(await getMyStore()).toEqual({
      id: 's1',
      name: 'Doces da Ana',
      slug: 'doces-da-ana',
      description: 'Bolos',
      categoryId: 'c1',
      logoPath: 'stores/s1/logo-x.webp',
      coverPath: null,
      status: 'rejected',
      kind: 'rejected',
      submittedAt: '2026-11-28T10:00:00.123456+00:00',
      decidedAt: null,
      createdAt: '2026-11-20T10:00:00+00:00',
      publishedProductsCount: 3,
      hiddenProductsCount: 1,
      soldOutProductsCount: 2,
      lastMessage: 'Junta um logótipo mais nítido.',
    });
  });

  it('depois de reenviar, a mensagem antiga não aparece', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ ...storeRow, status: 'pending_approval' }],
      error: null,
    });
    const store = await getMyStore();
    expect(store?.kind).toBe('pending');
    expect(store?.lastMessage).toBeNull();
  });

  it.each([
    ['draft', 'draft'],
    ['approved', 'approved'],
    ['suspended', 'suspended'],
  ])('o estado %s dá kind %s', async (status, kind) => {
    mocks.rpc.mockResolvedValue({ data: [{ ...storeRow, status }], error: null });
    expect((await getMyStore())?.kind).toBe(kind);
  });
});

describe('erros da base viram texto PT-AO', () => {
  it('NOT_STUDENT em saveMyStore', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'NOT_STUDENT', code: 'P0001' } });
    await expect(
      saveMyStore({ name: 'A', description: '', categoryId: 'c', logoPath: null, coverPath: null }),
    ).rejects.toThrow('Só os estudantes podem abrir uma loja.');
  });

  it.each([
    ['STORE_LOCKED', MESSAGES.storeLocked],
    ['STORE_INCOMPLETE', MESSAGES.storeIncomplete],
    ['NO_STORE', MESSAGES.noStore],
    ['INVALID_TRANSITION', MESSAGES.invalidTransition],
  ])('%s em submitMyStore', async (code, text) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: code, code: 'P0001' } });
    await expect(submitMyStore()).rejects.toThrow(text);
  });

  it('ALREADY_DECIDED e MESSAGE_REQUIRED têm o texto do canvas', () => {
    expect(translateDbError('ALREADY_DECIDED')).toBe(
      'Esta candidatura já foi decidida por outra pessoa da equipa. Atualizámos o estado.',
    );
    expect(translateDbError('MESSAGE_REQUIRED')).toBe(
      'Para recusar, diz à candidata o que deve corrigir.',
    );
  });

  it('PHOTO_REQUIRED ao publicar um produto sem fotos', async () => {
    queue({ data: null, error: { message: 'PHOTO_REQUIRED', code: 'P0001' } });
    await expect(updateProduct('p1', { isPublished: true })).rejects.toThrow(
      'Junta pelo menos uma foto.',
    );
  });

  it('INVALID_ORDER e CATEGORY_NOT_FOUND têm texto próprio', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'INVALID_ORDER', code: 'P0001' } });
    await expect(setProductImageOrder('p1', ['i1'])).rejects.toThrow(MESSAGES.invalidOrder);
    queue({ data: null, error: { message: 'CATEGORY_NOT_FOUND', code: 'P0001' } });
    await expect(updateProduct('p1', { categoryId: 'c' })).rejects.toThrow(
      MESSAGES.categoryNotFound,
    );
  });

  it('um erro técnico (23514) nunca chega ao utilizador', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'new row violates check constraint "x"', code: '23514' },
    });
    await expect(submitMyStore()).rejects.toThrow(MESSAGES.generic);
  });

  it('uma falha de rede vira a mensagem genérica', async () => {
    mocks.rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(submitMyStore()).rejects.toThrow(MESSAGES.generic);
  });
});

describe('saveMyStore e submitMyStore', () => {
  it('saveMyStore envia os argumentos p_* e devolve o id', async () => {
    mocks.rpc.mockResolvedValue({ data: 's1', error: null });
    const id = await saveMyStore({
      name: 'Doces da Ana',
      description: 'Bolos',
      categoryId: 'c1',
      logoPath: 'stores/s1/logo-x.webp',
      coverPath: null,
    });
    expect(id).toBe('s1');
    expect(mocks.rpc).toHaveBeenCalledWith('save_my_store', {
      p_name: 'Doces da Ana',
      p_description: 'Bolos',
      p_category_id: 'c1',
      p_logo_path: 'stores/s1/logo-x.webp',
      p_cover_path: null,
    });
  });

  it('submitMyStore chama a função sem argumentos', async () => {
    mocks.rpc.mockResolvedValue({ data: 'pending_approval', error: null });
    await submitMyStore();
    expect(mocks.rpc).toHaveBeenCalledWith('submit_my_store');
  });
});

describe('getMyStoreDecisions', () => {
  it('converte as linhas', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          decision: 'rejected',
          message: 'Falta o logótipo.',
          created_at: '2026-11-28T10:00:00+00:00',
        },
      ],
      error: null,
    });
    expect(await getMyStoreDecisions()).toEqual([
      {
        decision: 'rejected',
        message: 'Falta o logótipo.',
        createdAt: '2026-11-28T10:00:00+00:00',
      },
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith('get_my_store_decisions');
  });
});

describe('uploadStoreImage', () => {
  it('envia para stores/{id}/{kind}-{uuid}.webp e devolve o caminho', async () => {
    mocks.upload.mockResolvedValue({ data: {}, error: null });
    const blob = new Blob(['x'], { type: 'image/webp' });
    const path = await uploadStoreImage('s1', 'logo', blob);
    expect(path).toMatch(/^stores\/s1\/logo-[0-9a-f-]{36}\.webp$/);
    expect(mocks.storageFrom).toHaveBeenCalledWith('store-media');
    expect(mocks.upload).toHaveBeenCalledWith(path, blob, {
      contentType: 'image/webp',
      upsert: false,
    });
  });

  it('se o envio falhar, mostra uploadFailed', async () => {
    mocks.upload.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(uploadStoreImage('s1', 'cover', new Blob(['x']))).rejects.toThrow(
      MESSAGES.uploadFailed,
    );
  });

  it('se a rede cair, mostra uploadFailed', async () => {
    mocks.upload.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(uploadStoreImage('s1', 'cover', new Blob(['x']))).rejects.toThrow(
      MESSAGES.uploadFailed,
    );
  });
});

const productRow = {
  id: 'p1',
  name: 'Bolo',
  price_kz: 2500,
  stock: 4,
  is_published: true,
  created_at: '2026-11-28T10:00:00.654321+00:00',
  category_id: 'c1',
  moderation_status: 'visible',
  product_images: [
    { path: 'products/s1/p1/b.webp', position: 1 },
    { path: 'products/s1/p1/a.webp', position: 0 },
  ],
};

describe('listMyProducts', () => {
  it('lê products com colunas explícitas, ordem fixa e pede 21 para saber se há mais', async () => {
    queue({ data: [productRow], error: null });
    const page = await listMyProducts('s1', 'all');
    expect(mocks.state.calls[0]!.table).toBe('products');
    expect(String(op('select')![1])).not.toContain('*');
    expect(ops().filter((o) => o[0] === 'order')).toEqual([
      ['order', 'created_at', { ascending: false }],
      ['order', 'id', { ascending: false }],
    ]);
    expect(op('limit')).toEqual(['limit', 21]);
    expect(page.next).toBeNull();
    expect(page.items[0]).toMatchObject({
      id: 'p1',
      name: 'Bolo',
      priceKz: 2500,
      stock: 4,
      isPublished: true,
      createdAt: '2026-11-28T10:00:00.654321+00:00',
      mainImagePath: 'products/s1/p1/a.webp',
      moderationReason: null,
    });
    // O RLS público mostra os produtos de todas as lojas: a lista fica presa à loja do dono.
    expect(op('eq')).toEqual(['eq', 'store_id', 's1']);
    expect(String(op('select')![1])).toContain('moderation_reason');
  });

  it('com mais de 20 linhas, devolve 20 e o cursor do último', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      ...productRow,
      id: `p${i}`,
      created_at: `2026-11-28T10:00:${String(59 - i).padStart(2, '0')}.5+00:00`,
    }));
    queue({ data: rows, error: null });
    const page = await listMyProducts('s1', 'all');
    expect(page.items).toHaveLength(20);
    expect(page.next).toEqual({ createdAt: rows[19]!.created_at, id: 'p19' });
  });

  it('o cursor pede só o que vem depois (created_at, id), com o texto bruto', async () => {
    queue({ data: [], error: null });
    await listMyProducts('s1', 'all', { createdAt: '2026-11-28T10:00:00.654321+00:00', id: 'p9' });
    expect(op('or')![1]).toBe(
      'created_at.lt."2026-11-28T10:00:00.654321+00:00",and(created_at.eq."2026-11-28T10:00:00.654321+00:00",id.lt.p9)',
    );
  });

  it.each([
    [
      'published',
      [
        ['eq', 'store_id', 's1'],
        ['eq', 'is_published', true],
      ],
    ],
    [
      'sold_out',
      [
        ['eq', 'store_id', 's1'],
        ['eq', 'is_published', true],
        ['eq', 'stock', 0],
      ],
    ],
    [
      'hidden',
      [
        ['eq', 'store_id', 's1'],
        ['eq', 'is_published', false],
      ],
    ],
    ['all', [['eq', 'store_id', 's1']]],
  ] as const)('o filtro %s', async (filter, expected) => {
    queue({ data: [], error: null });
    await listMyProducts('s1', filter);
    expect(ops().filter((o) => o[0] === 'eq')).toEqual(expected);
  });

  it('uma falha da base vira texto PT-AO', async () => {
    queue({ data: null, error: { message: 'permission denied', code: '42501' } });
    await expect(listMyProducts('s1', 'all')).rejects.toThrow(MESSAGES.generic);
  });
});

describe('getMyProduct', () => {
  it('devolve null quando não existe (ou não é teu)', async () => {
    queue({ data: null, error: null });
    expect(await getMyProduct('s1', 'p1')).toBeNull();
    expect(ops().filter((o) => o[0] === 'eq')).toEqual([
      ['eq', 'id', 'p1'],
      ['eq', 'store_id', 's1'],
    ]);
  });

  it('devolve o detalhe com as fotos por ordem', async () => {
    queue({
      data: {
        ...productRow,
        description: 'Fofo',
        moderation_reason: null,
        product_images: [
          { id: 'i2', path: 'b', position: 1 },
          { id: 'i1', path: 'a', position: 0 },
        ],
      },
      error: null,
    });
    const p = await getMyProduct('s1', 'p1');
    expect(p).toMatchObject({ id: 'p1', description: 'Fofo', categoryId: 'c1' });
    expect(p?.images).toEqual([
      { id: 'i1', path: 'a', position: 0 },
      { id: 'i2', path: 'b', position: 1 },
    ]);
  });
});

describe('createProduct', () => {
  it('cria sempre com is_published false e devolve o id', async () => {
    queue({ data: { id: 'p9' }, error: null });
    const id = await createProduct({
      storeId: 's1',
      categoryId: 'c1',
      name: 'Bolo',
      description: 'Fofo',
      priceKz: 2500,
      stock: 4,
    });
    expect(id).toBe('p9');
    expect(mocks.state.calls[0]!.table).toBe('products');
    expect(op('insert')![1]).toEqual({
      store_id: 's1',
      category_id: 'c1',
      name: 'Bolo',
      description: 'Fofo',
      price_kz: 2500,
      stock: 4,
      is_published: false,
    });
  });
});

describe('countMyProducts', () => {
  it.each([
    ['all', [['eq', 'store_id', 's1']]],
    [
      'sold_out',
      [
        ['eq', 'store_id', 's1'],
        ['eq', 'is_published', true],
        ['eq', 'stock', 0],
      ],
    ],
  ] as const)('conta %s só com o cabeçalho, com os filtros da lista', async (filter, expected) => {
    queue({ data: null, count: 7, error: null });
    expect(await countMyProducts('s1', filter)).toBe(7);
    expect(op('select')).toEqual(['select', 'id', { count: 'exact', head: true }]);
    expect(ops().filter((o) => o[0] === 'eq')).toEqual(expected);
  });

  it('uma falha da base vira texto PT-AO', async () => {
    queue({ data: null, error: { message: 'boom', code: '42501' } });
    await expect(countMyProducts('s1', 'all')).rejects.toThrow(MESSAGES.generic);
  });
});

describe('updateProduct', () => {
  it('sem campos, não faz pedido nenhum', async () => {
    await updateProduct('p1', {});
    expect(mocks.state.calls).toHaveLength(0);
  });

  it('envia só os campos dados, em snake_case', async () => {
    queue({ data: [{ id: 'p1' }], error: null });
    await updateProduct('p1', { stock: 0, isPublished: false });
    expect(op('update')![1]).toEqual({ stock: 0, is_published: false });
    expect(op('eq')).toEqual(['eq', 'id', 'p1']);
    expect(op('select')).toEqual(['select', 'id']);
  });

  it('se as RLS não deixam tocar em nenhuma linha, é NOT_ALLOWED (não um sucesso falso)', async () => {
    queue({ data: [], error: null });
    await expect(updateProduct('p1', { stock: 1 })).rejects.toThrow(MESSAGES.notAllowed);
  });
});

describe('deleteProduct', () => {
  it('apaga a linha e depois os ficheiros', async () => {
    queue({ data: [{ id: 'p1' }], error: null });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    await deleteProduct('p1', ['products/s1/p1/a.webp']);
    expect(op('delete')).toBeDefined();
    expect(mocks.storageFrom).toHaveBeenCalledWith('product-media');
    expect(mocks.remove).toHaveBeenCalledWith(['products/s1/p1/a.webp']);
    expect(op('select')).toEqual(['select', 'id']);
  });

  it('se as RLS não deixam apagar nenhuma linha, é NOT_ALLOWED e os ficheiros ficam', async () => {
    queue({ data: [], error: null });
    await expect(deleteProduct('p1', ['a'])).rejects.toThrow(MESSAGES.notAllowed);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('se a linha não se apaga, os ficheiros ficam', async () => {
    queue({ error: { message: 'NOT_ALLOWED', code: 'P0001' } });
    await expect(deleteProduct('p1', ['a'])).rejects.toThrow(MESSAGES.notAllowed);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('se o Storage falhar depois, não lança (órfãos revistos à mão)', async () => {
    queue({ data: [{ id: 'p1' }], error: null });
    mocks.remove.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(deleteProduct('p1', ['a'])).resolves.toBeUndefined();
  });

  it('se o Storage devolver erro, não lança', async () => {
    queue({ data: [{ id: 'p1' }], error: null });
    mocks.remove.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(deleteProduct('p1', ['a'])).resolves.toBeUndefined();
  });

  it('sem ficheiros não chama o Storage', async () => {
    queue({ data: [{ id: 'p1' }], error: null });
    await deleteProduct('p1', []);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});

describe('fotos do produto', () => {
  it('uploadProductImage envia o ficheiro e insere a linha', async () => {
    mocks.upload.mockResolvedValue({ data: {}, error: null });
    queue({ data: { id: 'i1', path: 'x', position: 2 }, error: null });
    const blob = new Blob(['x'], { type: 'image/webp' });
    const img = await uploadProductImage('s1', 'p1', blob, 2);
    expect(mocks.storageFrom).toHaveBeenCalledWith('product-media');
    const [path, sent, options] = mocks.upload.mock.calls[0]!;
    expect(path).toMatch(/^products\/s1\/p1\/[0-9a-f-]{36}\.webp$/);
    expect(sent).toBe(blob);
    expect(options).toEqual({ contentType: 'image/webp', upsert: false });
    expect(mocks.state.calls[0]!.table).toBe('product_images');
    expect(op('insert')![1]).toEqual({ product_id: 'p1', path, position: 2 });
    expect(img).toEqual({ id: 'i1', path: 'x', position: 2 });
  });

  it('se a linha falhar, apaga o ficheiro acabado de enviar e lança', async () => {
    mocks.upload.mockResolvedValue({ data: {}, error: null });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    queue({ data: null, error: { message: 'INVALID_PATH', code: 'P0001' } });
    await expect(uploadProductImage('s1', 'p1', new Blob(['x']), 0)).rejects.toThrow(
      MESSAGES.invalidPath,
    );
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0]![0]]);
  });

  it('se o envio falhar, não insere nada', async () => {
    mocks.upload.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(uploadProductImage('s1', 'p1', new Blob(['x']), 0)).rejects.toThrow(
      MESSAGES.uploadFailed,
    );
    expect(mocks.state.calls).toHaveLength(0);
  });

  it('removeProductImage apaga a linha e depois o ficheiro', async () => {
    queue({ error: null });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    await removeProductImage({ id: 'i1', path: 'products/s1/p1/a.webp', position: 0 });
    expect(mocks.state.calls[0]!.table).toBe('product_images');
    expect(op('eq')).toEqual(['eq', 'id', 'i1']);
    expect(mocks.remove).toHaveBeenCalledWith(['products/s1/p1/a.webp']);
  });

  it('removeProductImage: a última foto de um produto publicado dá PHOTO_REQUIRED e o ficheiro fica', async () => {
    queue({ error: { message: 'PHOTO_REQUIRED', code: 'P0001' } });
    await expect(
      removeProductImage({ id: 'i1', path: 'products/s1/p1/a.webp', position: 0 }),
    ).rejects.toThrow(MESSAGES.photoRequired);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('setProductImageOrder chama a função com os ids', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await setProductImageOrder('p1', ['i2', 'i1']);
    expect(mocks.rpc).toHaveBeenCalledWith('set_product_image_order', {
      p_product_id: 'p1',
      p_image_ids: ['i2', 'i1'],
    });
  });
});
