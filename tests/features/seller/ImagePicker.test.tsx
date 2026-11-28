import { render, screen } from '@testing-library/react';
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

describe('ImagePicker', () => {
  it('recusa um formato que não é JPG, PNG ou WebP', async () => {
    const user = userEvent.setup({ delay: null, applyAccept: false });
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    await user.upload(screen.getByLabelText('Logótipo ou foto da loja'), file('image/gif', 10));
    expect(await screen.findByText(MESSAGES.imageFormat)).toBeInTheDocument();
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
    expect(await screen.findByText('A enviar a imagem…')).toBeInTheDocument();
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
