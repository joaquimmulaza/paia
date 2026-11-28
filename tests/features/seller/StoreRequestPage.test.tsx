import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sellerApi = vi.hoisted(() => ({
  getMyStore: vi.fn(),
  getMyStoreDecisions: vi.fn(),
  saveMyStore: vi.fn(),
  submitMyStore: vi.fn(),
  uploadStoreImage: vi.fn(),
}));
vi.mock('@/features/seller/api', () => sellerApi);
const authApi = vi.hoisted(() => ({ getMyProfile: vi.fn() }));
vi.mock('@/features/auth/api', () => authApi);
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

import { StoreRequestPage } from '@/features/seller/StoreRequestPage';
import { renderRoutes } from '../../utils/renderRoutes';
import { CATEGORIES, makeStore, student, teacher } from './fixtures';

function mount() {
  return renderRoutes(
    [
      { path: '/vender', element: <p>Quero vender</p> },
      { path: '/vender/pedido', element: <StoreRequestPage /> },
      { path: '/vender/estado', element: <p>Estado</p> },
      { path: '/vender/loja', element: <p>Painel</p> },
    ],
    '/vender/pedido',
  );
}

function png(name = 'logo.png', size = 1000) {
  const file = new File(['x'], name, { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
  authApi.getMyProfile.mockResolvedValue(student);
  catalogApi.listCategories.mockResolvedValue(CATEGORIES);
  images.compressImage.mockResolvedValue(new Blob(['w'], { type: 'image/webp' }));
});

describe('StoreRequestPage (V02, V02b)', () => {
  it('mostra o formulário V02 com o título «A tua loja»', async () => {
    sellerApi.getMyStore.mockResolvedValue(null);
    mount();
    expect(await screen.findByLabelText('Nome da loja')).toHaveValue('');
    expect(screen.getByRole('heading', { level: 1, name: 'A tua loja' })).toBeVisible();
    expect(screen.getByLabelText('Descrição')).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Doces' })).toBeInTheDocument();
    expect(screen.getByLabelText('Logótipo ou foto da loja')).toBeInTheDocument();
    expect(screen.getByLabelText(/Imagem de capa/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar para análise' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar rascunho' })).toBeInTheDocument();
    expect(document.title).toBe('A tua loja · PAIÁ');
  });

  it('enviar com o nome vazio mostra «Escreve o nome da loja.» e o resumo de 2 campos', async () => {
    const user = userEvent.setup({ delay: null });
    sellerApi.getMyStore.mockResolvedValue(makeStore({ logoPath: null }));
    mount();
    const name = await screen.findByLabelText('Nome da loja');
    await waitFor(() => expect(name).toHaveValue('Doces da Ana'));
    await user.clear(name);
    await user.click(screen.getByRole('button', { name: 'Enviar para análise' }));
    const summary = await screen.findByText(/Falta preencher 2 campos\./);
    expect(summary.closest('[role="alert"]')).toHaveFocus();
    expect(screen.getByText('Escreve o nome da loja.')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name.getAttribute('aria-describedby')).toContain(
      screen.getByText('Escreve o nome da loja.').closest('p')!.id,
    );
    expect(sellerApi.saveMyStore).not.toHaveBeenCalled();
    expect(sellerApi.submitMyStore).not.toHaveBeenCalled();
  });

  it('o resumo conta só os campos ainda com erro e sai quando já não há nenhum', async () => {
    const user = userEvent.setup({ delay: null });
    sellerApi.getMyStore.mockResolvedValue(makeStore({ logoPath: 'stores/store-1/logo-a.webp' }));
    mount();
    const name = await screen.findByLabelText('Nome da loja');
    await waitFor(() => expect(name).toHaveValue('Doces da Ana'));
    await user.clear(name);
    await user.clear(screen.getByLabelText('Descrição'));
    await user.click(screen.getByRole('button', { name: 'Enviar para análise' }));
    expect(await screen.findByText(/Falta preencher 2 campos\./)).toBeInTheDocument();
    await user.type(name, 'Doces');
    expect(screen.getByText(/Falta preencher 1 campo\./)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Descrição'), 'Bolos.');
    expect(screen.queryByText(/Falta preencher/)).toBeNull();
  });

  it('escrever «Pão & Café» mostra «…/loja/pao-cafe»', async () => {
    const user = userEvent.setup({ delay: null });
    sellerApi.getMyStore.mockResolvedValue(null);
    mount();
    await user.type(await screen.findByLabelText('Nome da loja'), 'Pão & Café');
    expect(screen.getByText('…/loja/pao-cafe')).toBeInTheDocument();
    expect(screen.getByText('10 de 60 caracteres.')).toBeInTheDocument();
  });

  it('com o endereço final diferente da pré-visualização, mostra a nota do «-2»', async () => {
    sellerApi.getMyStore.mockResolvedValue(makeStore({ slug: 'doces-da-ana-2' }));
    mount();
    expect(await screen.findByText('…/loja/doces-da-ana-2')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Já existe uma loja com este nome, por isso o endereço leva «-2». O nome que os compradores veem continua igual.',
      ),
    ).toBeInTheDocument();
  });

  it('enviar para análise guarda, envia, avisa e vai para /vender/estado', async () => {
    const user = userEvent.setup({ delay: null });
    sellerApi.getMyStore.mockResolvedValue(makeStore({ logoPath: 'stores/store-1/logo-a.webp' }));
    sellerApi.saveMyStore.mockResolvedValue('store-1');
    sellerApi.submitMyStore.mockResolvedValue(undefined);
    const { router } = mount();
    await waitFor(() => expect(screen.getByLabelText('Nome da loja')).toHaveValue('Doces da Ana'));
    await user.click(screen.getByRole('button', { name: 'Enviar para análise' }));
    expect(await screen.findByText('Estado')).toBeInTheDocument();
    // O TanStack Query passa um 2.º argumento (o contexto) à função da mutação.
    expect(sellerApi.saveMyStore.mock.calls[0]![0]).toEqual({
      name: 'Doces da Ana',
      description: 'Bolos por fatia e encomendas para aniversários.',
      categoryId: 'cat-doces',
      logoPath: 'stores/store-1/logo-a.webp',
      coverPath: null,
    });
    expect(sellerApi.submitMyStore).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Pedido enviado para análise.', { duration: 4000 });
    expect(router.state.location.pathname).toBe('/vender/estado');
  });

  it('se o envio falhar na rede, mostra o aviso e fica no formulário', async () => {
    const user = userEvent.setup({ delay: null });
    sellerApi.getMyStore.mockResolvedValue(makeStore({ logoPath: 'stores/store-1/logo-a.webp' }));
    sellerApi.saveMyStore.mockResolvedValue('store-1');
    sellerApi.submitMyStore.mockRejectedValue(new Error('Algo correu mal. Tenta outra vez.'));
    mount();
    await waitFor(() => expect(screen.getByLabelText('Nome da loja')).toHaveValue('Doces da Ana'));
    await user.click(screen.getByRole('button', { name: 'Enviar para análise' }));
    expect(
      await screen.findByText(
        'Não foi possível enviar o pedido. Verifica a ligação e tenta outra vez. O que escreveste ficou guardado.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nome da loja')).toHaveValue('Doces da Ana');
  });

  it('se o envio falhar já ao guardar, não diz que ficou guardado', async () => {
    const user = userEvent.setup({ delay: null });
    sellerApi.getMyStore.mockResolvedValue(makeStore({ logoPath: 'stores/store-1/logo-a.webp' }));
    sellerApi.saveMyStore.mockRejectedValue(new Error('Algo correu mal. Tenta outra vez.'));
    mount();
    await waitFor(() => expect(screen.getByLabelText('Nome da loja')).toHaveValue('Doces da Ana'));
    await user.click(screen.getByRole('button', { name: 'Enviar para análise' }));
    expect(
      await screen.findByText(
        'Não foi possível guardar o rascunho. Verifica a ligação e tenta outra vez. O que escreveste continua aqui.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/O que escreveste ficou guardado/)).not.toBeInTheDocument();
    expect(sellerApi.submitMyStore).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nome da loja')).toHaveValue('Doces da Ana');
  });

  it('«Guardar rascunho» só pede nome e categoria e avisa', async () => {
    const user = userEvent.setup({ delay: null });
    sellerApi.getMyStore.mockResolvedValue(null);
    sellerApi.saveMyStore.mockResolvedValue('store-1');
    mount();
    await user.type(await screen.findByLabelText('Nome da loja'), 'Doces da Ana');
    await screen.findByRole('option', { name: 'Doces' });
    await user.selectOptions(screen.getByLabelText('Categoria principal'), 'cat-doces');
    await user.click(screen.getByRole('button', { name: 'Guardar rascunho' }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Rascunho guardado. Podes continuar mais tarde, em Perfil.',
        { duration: 4000 },
      ),
    );
    expect(sellerApi.saveMyStore.mock.calls[0]![0]).toEqual({
      name: 'Doces da Ana',
      description: '',
      categoryId: 'cat-doces',
      logoPath: null,
      coverPath: null,
    });
    expect(sellerApi.submitMyStore).not.toHaveBeenCalled();
  });

  it('a primeira imagem sem loja e sem nome mostra os erros e não envia nada', async () => {
    const user = userEvent.setup({ delay: null });
    sellerApi.getMyStore.mockResolvedValue(null);
    mount();
    await user.upload(await screen.findByLabelText('Logótipo ou foto da loja'), png());
    expect(await screen.findByText('Escreve o nome da loja.')).toBeInTheDocument();
    expect(screen.getByText('Escolhe a categoria principal.')).toBeInTheDocument();
    expect(sellerApi.saveMyStore).not.toHaveBeenCalled();
    expect(sellerApi.uploadStoreImage).not.toHaveBeenCalled();
  });

  it('a primeira imagem sem loja cria o rascunho e depois envia o logótipo', async () => {
    const user = userEvent.setup({ delay: null });
    sellerApi.getMyStore.mockResolvedValue(null);
    sellerApi.saveMyStore.mockResolvedValue('store-1');
    sellerApi.uploadStoreImage.mockResolvedValue('stores/store-1/logo-x.webp');
    mount();
    await user.type(await screen.findByLabelText('Nome da loja'), 'Doces da Ana');
    await screen.findByRole('option', { name: 'Doces' });
    await user.selectOptions(screen.getByLabelText('Categoria principal'), 'cat-doces');
    await user.upload(screen.getByLabelText('Logótipo ou foto da loja'), png());
    await waitFor(() =>
      expect(sellerApi.uploadStoreImage).toHaveBeenCalledWith('store-1', 'logo', expect.any(Blob)),
    );
    expect(sellerApi.saveMyStore.mock.calls[0]![0]).toMatchObject({
      name: 'Doces da Ana',
      categoryId: 'cat-doces',
    });
    expect(await screen.findByRole('button', { name: 'Trocar' })).toBeInTheDocument();
  });

  it('com a loja em análise, vai para /vender/estado', async () => {
    sellerApi.getMyStore.mockResolvedValue(
      makeStore({ kind: 'pending', status: 'pending_approval' }),
    );
    const { router } = mount();
    expect(await screen.findByText('Estado')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/vender/estado');
  });

  it('uma conta que não é de estudante, sem loja, volta a /vender', async () => {
    authApi.getMyProfile.mockResolvedValue(teacher);
    sellerApi.getMyStore.mockResolvedValue(null);
    mount();
    expect(await screen.findByText('Quero vender')).toBeInTheDocument();
  });
});
