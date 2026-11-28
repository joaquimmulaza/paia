import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const images = vi.hoisted(() => ({ compressImage: vi.fn() }));
vi.mock('@/features/seller/images', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/seller/images')>()),
  compressImage: images.compressImage,
}));

import { ImagePicker } from '@/features/seller/components/ImagePicker';
import { MESSAGES } from '@/lib/errors';

function file(type: string, size: number, name = 'foto') {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

const MB = 1024 * 1024;

beforeEach(() => {
  vi.clearAllMocks();
  images.compressImage.mockResolvedValue(new Blob(['w'], { type: 'image/webp' }));
});

function Harness({ onPick }: { onPick: (b: Blob) => Promise<string> }) {
  return <ImagePicker label="Logótipo ou foto da loja" value={null} onPick={onPick} required />;
}

/** Como o formulário: guarda o caminho devolvido por `onPick` e passa-o em `value`. */
function Stateful(props: {
  label: string;
  shortLabel?: string;
  feminine?: boolean;
  onPick: (b: Blob) => Promise<string>;
}) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <ImagePicker
      {...props}
      value={value}
      onPick={async (b) => {
        const path = await props.onPick(b);
        setValue(path);
        return path;
      }}
      onRemove={() => setValue(null)}
    />
  );
}

function liveRegion() {
  return document.querySelector('[aria-live="polite"]');
}

describe('ImagePicker', () => {
  it('anuncia o envio e o fim, e passa o foco para «Trocar»', async () => {
    const user = userEvent.setup({ delay: null });
    let resolve: (path: string) => void = () => {};
    const onPick = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    render(<Stateful label="Logótipo ou foto da loja" shortLabel="Logótipo" onPick={onPick} />);
    const region = liveRegion();
    expect(region).toBeInTheDocument();
    const input = screen.getByLabelText('Logótipo ou foto da loja');
    await user.upload(input, file('image/png', MB));
    await waitFor(() => expect(region).toHaveTextContent('A enviar a imagem…'));
    // O mesmo input, sempre montado: o foco não cai no <body> a meio.
    expect(screen.getByLabelText('Logótipo ou foto da loja')).toBe(input);
    expect(input).not.toBeDisabled();
    resolve('stores/s/logo-1.webp');
    await waitFor(() => expect(region).toHaveTextContent('Logótipo enviado.'));
    expect(screen.getByRole('button', { name: 'Trocar' })).toHaveFocus();
    // Depois de escolhida, «Trocar» é o controlo: o input sai da ordem do Tab.
    expect(input).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('img', { name: 'Logótipo escolhido' })).toBeInTheDocument();
  });

  it('a imagem de capa concorda no feminino', async () => {
    const user = userEvent.setup({ delay: null });
    const onPick = vi.fn(async () => 'stores/s/cover-1.webp');
    render(<Stateful label="Imagem de capa" feminine onPick={onPick} />);
    await user.upload(screen.getByLabelText('Imagem de capa'), file('image/png', MB));
    expect(await screen.findByRole('img', { name: 'Imagem de capa escolhida' })).toBeVisible();
    expect(liveRegion()).toHaveTextContent('Imagem de capa enviada.');
  });

  it('um erro de imagem é anunciado (role=alert) e o foco fica no campo', async () => {
    const user = userEvent.setup({ delay: null, applyAccept: false });
    const onPick = vi
      .fn<(b: Blob) => Promise<string>>()
      .mockRejectedValue(new Error(MESSAGES.uploadFailed));
    render(<Stateful label="Logótipo" onPick={onPick} />);
    const input = screen.getByLabelText('Logótipo');
    await user.upload(input, file('image/png', MB));
    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGES.uploadFailed);
    expect(input).toHaveFocus();
    expect(input).not.toHaveAttribute('tabindex', '-1');
  });

  it('recusa um formato que não é JPG, PNG ou WebP', async () => {
    const user = userEvent.setup({ delay: null, applyAccept: false });
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    await user.upload(screen.getByLabelText('Logótipo ou foto da loja'), file('image/gif', 10));
    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGES.imageFormat);
    expect(screen.getByText('Escolher outra imagem')).toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('recusa um original com mais de 15 MB, com o tamanho', async () => {
    const user = userEvent.setup({ delay: null });
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    const input = screen.getByLabelText('Logótipo ou foto da loja');
    await user.upload(input, file('image/jpeg', 18 * MB));
    expect(await screen.findByText(MESSAGES.imageTooLarge(18))).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(onPick).not.toHaveBeenCalled();
  });

  it('comprime, mostra «A enviar a imagem…» e depois «Trocar» e «Remover»', async () => {
    const user = userEvent.setup({ delay: null });
    let resolve: (path: string) => void = () => {};
    const onPick = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const onRemove = vi.fn();
    const { rerender } = render(
      <ImagePicker label="Logótipo" value={null} onPick={onPick} onRemove={onRemove} />,
    );
    await user.upload(screen.getByLabelText('Logótipo'), file('image/png', MB));
    await waitFor(() => expect(liveRegion()).toHaveTextContent('A enviar a imagem…'));
    expect(images.compressImage).toHaveBeenCalled();
    resolve('stores/s/logo-1.webp');
    rerender(
      <ImagePicker
        label="Logótipo"
        value="stores/s/logo-1.webp"
        onPick={onPick}
        onRemove={onRemove}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Remover' }));
    expect(onRemove).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Trocar' })).toBeInTheDocument();
  });

  it('se o envio falhar, mostra o erro e «Tentar outra vez» repete com a mesma imagem', async () => {
    const user = userEvent.setup({ delay: null });
    const onPick = vi
      .fn<(b: Blob) => Promise<string>>()
      .mockRejectedValueOnce(new Error(MESSAGES.uploadFailed))
      .mockResolvedValueOnce('stores/s/logo-2.webp');
    render(<Harness onPick={onPick} />);
    await user.upload(screen.getByLabelText('Logótipo ou foto da loja'), file('image/png', MB));
    expect(await screen.findByText(MESSAGES.uploadFailed)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(onPick).toHaveBeenCalledTimes(2);
    expect(onPick.mock.calls[1]![0]).toBe(onPick.mock.calls[0]![0]);
  });
});
