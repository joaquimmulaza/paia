import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sellerApi = vi.hoisted(() => ({
  getMyStore: vi.fn(),
  saveMyStore: vi.fn(),
  uploadStoreImage: vi.fn(),
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

import { StoreEditPage } from '@/features/seller/StoreEditPage';
import { renderRoutes } from '../../utils/renderRoutes';
import { CATEGORIES, makeStore } from './fixtures';

function mount() {
  return renderRoutes(
    [
      { path: '/vender', element: <p>Quero vender</p> },
      { path: '/vender/estado', element: <p>Estado</p> },
      { path: '/vender/loja', element: <p>Painel</p> },
      { path: '/vender/loja/editar', element: <StoreEditPage /> },
    ],
    '/vender/loja/editar',
  );
}

const approved = makeStore({
  id: 's1',
  status: 'approved',
  kind: 'approved',
  logoPath: 'stores/s1/logo-a.webp',
  coverPath: null,
});

function png() {
  const file = new File(['x'], 'logo.png', { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: 1000 });
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
  sellerApi.getMyStore.mockResolvedValue(approved);
  sellerApi.saveMyStore.mockResolvedValue('s1');
  sellerApi.uploadStoreImage.mockResolvedValue('stores/s1/logo-b.webp');
  catalogApi.listCategories.mockResolvedValue(CATEGORIES);
  images.compressImage.mockResolvedValue(new Blob(['w'], { type: 'image/webp' }));
});

describe('StoreEditPage (V02c)', () => {
  it('mostra os dados atuais, o endereço só de leitura e o logótipo sem «Remover»', async () => {
    mount();
    expect(await screen.findByLabelText('Nome da loja')).toHaveValue('Doces da Ana');
    expect(screen.getByRole('heading', { level: 1, name: 'Editar loja' })).toBeVisible();
    expect(
      screen.getByText('As alterações aparecem logo na loja. Não precisam de nova análise.'),
    ).toBeVisible();
    expect(screen.getByLabelText('Nome da loja')).toHaveValue('Doces da Ana');
    expect(screen.getByText('12 de 60 caracteres.')).toBeVisible();
    expect(screen.getByText('…/loja/doces-da-ana')).toBeVisible();
    expect(
      screen.getByText(
        'O endereço não muda depois de a loja ser aprovada, para não quebrar as ligações que já partilhaste.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Trocar' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Imagem de capa/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/vender/loja');
    expect(screen.getByRole('link', { name: 'Voltar ao painel' })).toHaveAttribute(
      'href',
      '/vender/loja',
    );
  });

  it('guarda com saveMyStore e avisa «Alterações guardadas.»', async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    const name = await screen.findByLabelText('Nome da loja');
    await user.clear(name);
    await user.type(name, 'Doces da Ana e Filhos');
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Alterações guardadas.', expect.anything()),
    );
    expect(sellerApi.saveMyStore.mock.calls[0]![0]).toEqual({
      name: 'Doces da Ana e Filhos',
      description: 'Bolos por fatia e encomendas para aniversários.',
      categoryId: 'cat-doces',
      logoPath: 'stores/s1/logo-a.webp',
      coverPath: null,
    });
  });

  it('trocar o logótipo envia a imagem e guarda o novo caminho', async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    await screen.findByRole('button', { name: 'Trocar' });
    await user.upload(screen.getByLabelText('Logótipo'), png());
    await waitFor(() =>
      expect(sellerApi.uploadStoreImage).toHaveBeenCalledWith('s1', 'logo', expect.any(Blob)),
    );
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));
    await waitFor(() => expect(sellerApi.saveMyStore).toHaveBeenCalled());
    expect(sellerApi.saveMyStore.mock.calls[0]![0]).toMatchObject({
      logoPath: 'stores/s1/logo-b.webp',
    });
  });

  it('com o logótipo a enviar, «Guardar alterações» pede para esperar e não guarda', async () => {
    const user = userEvent.setup({ delay: null });
    sellerApi.uploadStoreImage.mockReturnValue(new Promise(() => {}));
    mount();
    await screen.findByRole('button', { name: 'Trocar' });
    await user.upload(screen.getByLabelText('Logótipo'), png());
    await waitFor(() => expect(sellerApi.uploadStoreImage).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Espera que as imagens acabem de enviar e guarda outra vez.',
    );
    expect(sellerApi.saveMyStore).not.toHaveBeenCalled();
  });

  it('com a capa ainda a comprimir, «Guardar alterações» também espera', async () => {
    const user = userEvent.setup({ delay: null });
    images.compressImage.mockReturnValue(new Promise(() => {}));
    mount();
    await screen.findByRole('button', { name: 'Trocar' });
    await user.upload(screen.getByLabelText('Imagem de capa (opcional)'), png());
    await waitFor(() => expect(images.compressImage).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Espera que as imagens acabem de enviar e guarda outra vez.',
    );
    expect(sellerApi.saveMyStore).not.toHaveBeenCalled();
  });

  it('a descrição vazia mostra o erro do V02b e não guarda', async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    await user.clear(await screen.findByLabelText('Descrição'));
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));
    expect(await screen.findByText('Diz em poucas palavras o que vendes.')).toBeVisible();
    expect(screen.getByLabelText('Descrição')).toHaveFocus();
    expect(sellerApi.saveMyStore).not.toHaveBeenCalled();
  });

  it('uma loja suspensa segue para /vender/estado', async () => {
    sellerApi.getMyStore.mockResolvedValue(makeStore({ kind: 'suspended', status: 'suspended' }));
    const { router } = mount();
    await waitFor(() => expect(router.state.location.pathname).toBe('/vender/estado'));
  });
});
