import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sellerApi = vi.hoisted(() => ({
  getMyStore: vi.fn(),
  getMyProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  uploadProductImage: vi.fn(),
  removeProductImage: vi.fn(),
  setProductImageOrder: vi.fn(),
}));
vi.mock('@/features/seller/api', () => sellerApi);
const catalogApi = vi.hoisted(() => ({ listCategories: vi.fn() }));
vi.mock('@/features/catalog/api', () => catalogApi);
vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-test' } }, loading: false }),
  currentUserId: () => 'user-test',
}));
const images = vi.hoisted(() => ({ compressImage: vi.fn() }));
vi.mock('@/features/seller/images', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/seller/images')>()),
  compressImage: images.compressImage,
}));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast,
}));

import { ProductFormPage } from '@/features/seller/ProductFormPage';
import type { MyProductDetail } from '@/features/seller/types';
import { MESSAGES } from '@/lib/errors';
import { renderRoutes } from '../../utils/renderRoutes';
import { CATEGORIES, makeStore } from './fixtures';

function mount(path: string) {
  return renderRoutes(
    [
      { path: '/vender', element: <p>Quero vender</p> },
      { path: '/vender/estado', element: <p>Estado</p> },
      { path: '/vender/produtos', element: <p>Lista de produtos</p> },
      { path: '/vender/produtos/novo', element: <ProductFormPage /> },
      { path: '/vender/produtos/:id', element: <ProductFormPage /> },
    ],
    path,
  );
}

const approved = makeStore({ id: 's1', status: 'approved', kind: 'approved' });

function png(name = 'foto.png') {
  const file = new File(['x'], name, { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: 1000 });
  return file;
}

const detail: MyProductDetail = {
  id: 'p1',
  name: 'Pudim (fatia)',
  description: 'Caseiro.',
  priceKz: 900,
  stock: 6,
  isPublished: true,
  moderationStatus: 'visible',
  moderationReason: null,
  categoryId: 'cat-doces',
  createdAt: '2026-11-28T10:00:00+00:00',
  mainImagePath: 'products/s1/p1/a.webp',
  images: [
    { id: 'i1', path: 'products/s1/p1/a.webp', position: 0 },
    { id: 'i2', path: 'products/s1/p1/b.webp', position: 1 },
  ],
};

let nextImage = 0;
beforeEach(() => {
  vi.clearAllMocks();
  nextImage = 0;
  sellerApi.getMyStore.mockResolvedValue(approved);
  catalogApi.listCategories.mockResolvedValue(CATEGORIES);
  images.compressImage.mockResolvedValue(new Blob(['w'], { type: 'image/webp' }));
  sellerApi.createProduct.mockResolvedValue('new-1');
  sellerApi.updateProduct.mockResolvedValue(undefined);
  sellerApi.deleteProduct.mockResolvedValue(undefined);
  sellerApi.setProductImageOrder.mockResolvedValue(undefined);
  sellerApi.removeProductImage.mockResolvedValue(undefined);
  sellerApi.uploadProductImage.mockImplementation(
    async (_s: string, productId: string, _b: Blob, position: number) => {
      nextImage += 1;
      return {
        id: `up-${nextImage}`,
        path: `products/s1/${productId}/u${nextImage}.webp`,
        position,
      };
    },
  );
});

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Nome'), 'Pudim (fatia)');
  await screen.findByRole('option', { name: 'Doces' });
  await user.clear(screen.getByLabelText('Preço (Kz)'));
  await user.type(screen.getByLabelText('Preço (Kz)'), '900');
  await user.clear(screen.getByLabelText('Stock'));
  await user.type(screen.getByLabelText('Stock'), '6');
}

describe('ProductFormPage, novo produto (V06)', () => {
  it('mostra o formulário V06', async () => {
    mount('/vender/produtos/novo');
    expect(await screen.findByLabelText('Juntar foto')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Novo produto' })).toBeVisible();
    expect(screen.getByText('Até 5 fotos, JPG, PNG ou WebP.')).toBeVisible();
    expect(screen.getByLabelText('Descrição')).toHaveAttribute(
      'placeholder',
      'O que é, tamanho, ingredientes ou material.',
    );
    expect(screen.getByRole('switch', { name: /Publicar na loja/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Publicar produto' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Voltar aos produtos' })).toHaveAttribute(
      'href',
      '/vender/produtos',
    );
  });

  it('com preço 0 mostra «O preço tem de ser pelo menos 1 Kz, sem casas decimais.»', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/vender/produtos/novo');
    await fillValid(user);
    await user.clear(screen.getByLabelText('Preço (Kz)'));
    await user.type(screen.getByLabelText('Preço (Kz)'), '0');
    await user.click(screen.getByRole('button', { name: 'Publicar produto' }));
    expect(
      await screen.findByText('O preço tem de ser pelo menos 1 Kz, sem casas decimais.'),
    ).toBeVisible();
    expect(screen.getByLabelText('Preço (Kz)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Preço (Kz)')).toHaveFocus();
    expect(sellerApi.createProduct).not.toHaveBeenCalled();
  });

  it('com o nome vazio e o stock inválido mostra os erros do V06b', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/vender/produtos/novo');
    await screen.findByRole('option', { name: 'Doces' });
    await user.type(screen.getByLabelText('Preço (Kz)'), '900');
    await user.type(screen.getByLabelText('Stock'), '-1');
    await user.click(screen.getByRole('button', { name: 'Publicar produto' }));
    expect(await screen.findByText('Escreve o nome do produto.')).toBeVisible();
    expect(screen.getByText('Indica um número inteiro, 0 ou mais.')).toBeVisible();
    expect(screen.getByLabelText('Nome')).toHaveFocus();
  });

  it('publicar sem fotos mostra «Junta pelo menos uma foto.»', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/vender/produtos/novo');
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Publicar produto' }));
    expect(await screen.findByText('Junta pelo menos uma foto.')).toBeVisible();
    expect(sellerApi.createProduct).not.toHaveBeenCalled();
  });

  it('desligado «Publicar na loja», guarda oculto sem fotos', async () => {
    const user = userEvent.setup({ delay: null });
    const { router } = mount('/vender/produtos/novo');
    await fillValid(user);
    await user.click(screen.getByRole('switch', { name: /Publicar na loja/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar produto' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/vender/produtos'));
    expect(sellerApi.createProduct).toHaveBeenCalledWith({
      storeId: 's1',
      categoryId: 'cat-doces',
      name: 'Pudim (fatia)',
      description: '',
      priceKz: 900,
      stock: 6,
    });
    expect(sellerApi.updateProduct).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Produto guardado.', expect.anything());
  });

  it('com os campos prontos, a primeira foto cria o produto oculto e envia a foto para ele', async () => {
    const user = userEvent.setup({ delay: null });
    const { router } = mount('/vender/produtos/novo');
    await fillValid(user);
    await user.upload(screen.getByLabelText('Juntar foto'), png());
    expect(await screen.findByRole('button', { name: 'Foto 1, principal' })).toBeVisible();
    expect(sellerApi.createProduct).toHaveBeenCalledTimes(1);
    expect(sellerApi.uploadProductImage).toHaveBeenCalledWith('s1', 'new-1', expect.any(Blob), 0);

    await user.click(screen.getByRole('button', { name: 'Publicar produto' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/vender/produtos'));
    expect(sellerApi.createProduct).toHaveBeenCalledTimes(1);
    expect(sellerApi.updateProduct).toHaveBeenCalledWith(
      'new-1',
      expect.objectContaining({ isPublished: true, name: 'Pudim (fatia)' }),
    );
    expect(toast.success).toHaveBeenCalledWith('Produto publicado.', expect.anything());
  });

  it('a foto escolhida antes dos campos espera: ao publicar, cria, envia e só depois publica', async () => {
    const user = userEvent.setup({ delay: null });
    const { router } = mount('/vender/produtos/novo');
    await screen.findByRole('option', { name: 'Doces' });
    await user.upload(screen.getByLabelText('Juntar foto'), png());
    expect(await screen.findByRole('button', { name: 'Foto 1, principal' })).toBeVisible();
    expect(sellerApi.createProduct).not.toHaveBeenCalled();
    expect(screen.queryByText('Escreve o nome do produto.')).not.toBeInTheDocument();

    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Publicar produto' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/vender/produtos'));
    const order = [
      sellerApi.createProduct.mock.invocationCallOrder[0]!,
      sellerApi.uploadProductImage.mock.invocationCallOrder[0]!,
      sellerApi.updateProduct.mock.invocationCallOrder[0]!,
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(sellerApi.updateProduct).toHaveBeenCalledWith('new-1', { isPublished: true });
  });

  it('com 5 fotos, juntar outra mostra «Já tens 5 fotos. Remove uma para juntar outra.»', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/vender/produtos/novo');
    await screen.findByRole('option', { name: 'Doces' });
    await user.upload(screen.getByLabelText('Juntar foto'), [
      png('1.png'),
      png('2.png'),
      png('3.png'),
      png('4.png'),
      png('5.png'),
      png('6.png'),
    ]);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Já tens 5 fotos. Remove uma para juntar outra.',
    );
    expect(await screen.findByRole('button', { name: 'Foto 5' })).toBeVisible();
    expect(screen.queryByLabelText('Juntar foto')).not.toBeInTheDocument();
  });

  it('«Cancelar» depois de criado apaga o produto e as fotos', async () => {
    const user = userEvent.setup({ delay: null });
    const { router } = mount('/vender/produtos/novo');
    await fillValid(user);
    await user.upload(screen.getByLabelText('Juntar foto'), png());
    await screen.findByRole('button', { name: 'Foto 1, principal' });
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/vender/produtos'));
    expect(sellerApi.deleteProduct).toHaveBeenCalledWith('new-1', ['products/s1/new-1/u1.webp']);
  });
});

describe('ProductFormPage, editar produto (V06b)', () => {
  beforeEach(() => {
    sellerApi.getMyProduct.mockResolvedValue(detail);
  });

  it('mostra o produto com as fotos e guarda as alterações', async () => {
    const user = userEvent.setup({ delay: null });
    const { router } = mount('/vender/produtos/p1');
    expect(await screen.findByLabelText('Nome')).toHaveValue('Pudim (fatia)');
    expect(screen.getByRole('heading', { level: 1, name: 'Editar produto' })).toBeVisible();
    expect(sellerApi.getMyProduct).toHaveBeenCalledWith('s1', 'p1');
    expect(screen.getByLabelText('Preço (Kz)')).toHaveValue('900');
    expect(screen.getByRole('button', { name: 'Foto 1, principal' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Foto 2' })).toBeVisible();
    await user.clear(screen.getByLabelText('Stock'));
    await user.type(screen.getByLabelText('Stock'), '0');
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/vender/produtos'));
    expect(sellerApi.updateProduct).toHaveBeenCalledWith('p1', {
      name: 'Pudim (fatia)',
      description: 'Caseiro.',
      categoryId: 'cat-doces',
      priceKz: 900,
      stock: 0,
      isPublished: true,
    });
    expect(toast.success).toHaveBeenCalledWith('Alterações guardadas.', expect.anything());
  });

  it('«Tornar principal» na foto 2 chama setProductImageOrder com essa foto primeiro', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/vender/produtos/p1');
    await user.click(await screen.findByRole('button', { name: 'Foto 2' }));
    expect(screen.getByRole('button', { name: 'Foto 2' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Tornar principal' }));
    expect(sellerApi.setProductImageOrder).toHaveBeenCalledWith('p1', ['i2', 'i1']);
    const main = await screen.findByRole('button', { name: 'Foto 1, principal' });
    expect(main).toHaveFocus();
    expect(main.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('products/s1/p1/b.webp'),
    );
  });

  it('«Mover para a esquerda» troca com a anterior', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/vender/produtos/p1');
    await user.click(await screen.findByRole('button', { name: 'Foto 2' }));
    await user.click(screen.getByRole('button', { name: 'Mover foto 2 para a esquerda' }));
    expect(sellerApi.setProductImageOrder).toHaveBeenCalledWith('p1', ['i2', 'i1']);
  });

  it('com INVALID_ORDER, mostra as fotos do servidor e o aviso', async () => {
    const user = userEvent.setup({ delay: null });
    sellerApi.setProductImageOrder.mockRejectedValue(new Error(MESSAGES.invalidOrder));
    mount('/vender/produtos/p1');
    await user.click(await screen.findByRole('button', { name: 'Foto 2' }));
    // Entretanto, noutro aparelho, entrou uma terceira foto.
    sellerApi.getMyProduct.mockResolvedValue({
      ...detail,
      images: [...detail.images, { id: 'i3', path: 'products/s1/p1/c.webp', position: 2 }],
    });
    await user.click(screen.getByRole('button', { name: 'Tornar principal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGES.invalidOrder);
    expect(await screen.findByRole('button', { name: 'Foto 3' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Foto 1, principal' }).querySelector('img'),
    ).toHaveAttribute('src', expect.stringContaining('products/s1/p1/a.webp'));
  });

  it('remover a última foto de um produto publicado mostra a recusa do servidor', async () => {
    const user = userEvent.setup({ delay: null });
    sellerApi.getMyProduct.mockResolvedValue({ ...detail, images: [detail.images[0]!] });
    sellerApi.removeProductImage.mockRejectedValue(new Error(MESSAGES.photoRequired));
    mount('/vender/produtos/p1');
    await user.click(await screen.findByRole('button', { name: 'Remover foto 1' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Junta pelo menos uma foto.');
    expect(sellerApi.removeProductImage).toHaveBeenCalledWith(detail.images[0]);
    expect(screen.getByRole('button', { name: 'Foto 1, principal' })).toBeVisible();
  });

  it('remover uma foto tira-a e acerta a ordem para a principal ficar na posição 0', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/vender/produtos/p1');
    await user.click(await screen.findByRole('button', { name: 'Remover foto 1' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Foto 2' })).toBeNull());
    expect(sellerApi.removeProductImage).toHaveBeenCalledWith(detail.images[0]);
    expect(sellerApi.setProductImageOrder).toHaveBeenCalledWith('p1', ['i2']);
  });

  it('com fotos a enviar, «Guardar alterações» pede para esperar', async () => {
    const user = userEvent.setup({ delay: null });
    sellerApi.uploadProductImage.mockReturnValue(new Promise(() => {}));
    mount('/vender/produtos/p1');
    await user.upload(await screen.findByLabelText('Juntar foto'), png());
    expect(await screen.findByText('A enviar…')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Espera que as fotos acabem de enviar e guarda outra vez.',
    );
    expect(sellerApi.updateProduct).not.toHaveBeenCalled();
  });

  it('confirmar a remoção chama deleteProduct com os caminhos das fotos', async () => {
    const user = userEvent.setup({ delay: null });
    const { router } = mount('/vender/produtos/p1');
    await user.click(await screen.findByRole('button', { name: 'Apagar produto' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Apagar «Pudim (fatia)»?' });
    expect(dialog).toHaveTextContent(
      'O produto e as fotos saem da loja e não podes desfazer. Se só queres pausar a venda, desliga «Publicar na loja».',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Apagar produto' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/vender/produtos'));
    expect(sellerApi.deleteProduct).toHaveBeenCalledWith('p1', [
      'products/s1/p1/a.webp',
      'products/s1/p1/b.webp',
    ]);
    expect(toast.success).toHaveBeenCalledWith('Produto apagado.', expect.anything());
  });

  it('um produto que não é teu mostra «Não encontrámos o que procuras.»', async () => {
    sellerApi.getMyProduct.mockResolvedValue(null);
    mount('/vender/produtos/outro');
    expect(await screen.findByRole('heading', { name: MESSAGES.notFound })).toBeVisible();
  });
});
