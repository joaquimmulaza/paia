// Design system: CartaoProduto, fotografia (p-pcard__photo).
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { publicImageUrl } from '../labels';

type ProductPhotoProps = {
  path: string | null;
  /** O nome do produto. */
  alt: string;
  className?: string;
};

/** Com `path`, a fotografia; sem ela, o fundo brand-tint com o ícone de imagem, sem texto. */
export function ProductPhoto({ path, alt, className }: ProductPhotoProps) {
  if (path) {
    return (
      <img
        src={publicImageUrl('product-media', path)}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn('block size-full object-cover', className)}
      />
    );
  }
  return (
    <div
      className={cn(
        'flex size-full items-center justify-center bg-brand-tint text-ink-muted',
        className,
      )}
    >
      <ImageIcon aria-hidden="true" className="size-6" />
    </div>
  );
}
