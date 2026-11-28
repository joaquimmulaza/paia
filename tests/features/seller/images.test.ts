import { beforeEach, describe, expect, it, vi } from 'vitest';

const { imageCompression } = vi.hoisted(() => ({ imageCompression: vi.fn() }));
vi.mock('browser-image-compression', () => ({ default: imageCompression }));

import { checkImageFile, compressImage } from '@/features/seller/images';

const MB = 1024 * 1024;
function file(type: string, size: number): File {
  const f = new File(['x'], 'foto', { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('checkImageFile', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('aceita %s', (type) => {
    expect(checkImageFile(file(type, 1 * MB))).toBeNull();
  });

  it('recusa um formato que não é JPG, PNG nem WebP', () => {
    expect(checkImageFile(file('image/gif', 1 * MB))).toBe('format');
  });

  it('aceita 15 MB certos e recusa acima', () => {
    expect(checkImageFile(file('image/png', 15 * MB))).toBeNull();
    expect(checkImageFile(file('image/png', 16 * MB))).toBe('too_large');
  });

  it('o formato manda sobre o tamanho', () => {
    expect(checkImageFile(file('image/gif', 20 * MB))).toBe('format');
  });
});

describe('compressImage', () => {
  it('chama a biblioteca com as opções fixadas e devolve o resultado', async () => {
    const out = new Blob(['y'], { type: 'image/webp' });
    imageCompression.mockResolvedValue(out);
    const input = file('image/jpeg', 5 * MB);
    expect(await compressImage(input)).toBe(out);
    expect(imageCompression).toHaveBeenCalledWith(input, {
      maxWidthOrHeight: 1600,
      fileType: 'image/webp',
      initialQuality: 0.8,
      maxSizeMB: 2,
      // Sem Web Worker: a biblioteca carregaria o worker de um CDN de terceiros.
      useWebWorker: false,
    });
  });

  it('se o resultado passar de 2 MB, lança compress_failed', async () => {
    imageCompression.mockResolvedValue(new Blob([new Uint8Array(2 * MB + 1)]));
    await expect(compressImage(file('image/png', 9 * MB))).rejects.toThrow('compress_failed');
  });

  it('se a biblioteca falhar, lança compress_failed', async () => {
    imageCompression.mockRejectedValue(new Error('canvas'));
    await expect(compressImage(file('image/png', 1 * MB))).rejects.toThrow('compress_failed');
  });
});
