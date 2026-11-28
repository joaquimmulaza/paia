import imageCompression from 'browser-image-compression';

export type ImageProblem = 'format' | 'too_large' | 'compress_failed';

export const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024;
/** O bucket recusa mais do que isto. */
export const MAX_COMPRESSED_BYTES = 2 * 1024 * 1024;

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Verifica o original escolhido: JPG, PNG ou WebP, até 15 MB. */
export function checkImageFile(file: File): ImageProblem | null {
  if (!ACCEPTED.has(file.type)) return 'format';
  if (file.size > MAX_ORIGINAL_BYTES) return 'too_large';
  return null;
}

/**
 * Comprime para WebP (lado maior até 1600 px, qualidade 0,8), o que também remove o EXIF.
 * Lança `Error('compress_failed')` se a biblioteca falhar ou o resultado passar de 2 MB.
 */
export async function compressImage(file: File): Promise<Blob> {
  let out: Blob;
  try {
    out = await imageCompression(file, {
      maxWidthOrHeight: 1600,
      fileType: 'image/webp',
      initialQuality: 0.8,
      maxSizeMB: 2,
    });
  } catch {
    throw new Error('compress_failed');
  }
  if (out.size > MAX_COMPRESSED_BYTES) throw new Error('compress_failed');
  return out;
}
