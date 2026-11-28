// V06 e V06b · Fotos do produto (v-ph): até 5, numa grelha de 3. Cada foto é um botão que a
// escolhe; escolhida, aparecem «Tornar principal» e «Mover para a esquerda» (sem arrastar:
// igual com o dedo, o teclado e o leitor de ecrã). O padrão de acessibilidade é o do
// ImagePicker: região aria-live sempre montada, erros com role="alert" e o foco nunca cai no
// <body>. Cada original é verificado e comprimido antes de enviar.
import { ImageIcon, Plus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type MutableRefObject } from 'react';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/features/auth/AuthErrorAlert';
import { publicImageUrl } from '@/features/catalog/labels';
import { tagClass } from '@/features/catalog/components/tag-styles';
import { MESSAGES } from '@/lib/errors';
import { cn, focusRing } from '@/lib/utils';
import { checkImageFile, compressImage } from '../images';
import { useRemoveProductImage, useSetProductImageOrder, useUploadProductImage } from '../queries';
import type { ProductImage } from '../types';
import { FieldError } from './form-ui';

export const MAX_PHOTOS = 5;

export type PhotoSlot =
  | { key: string; status: 'saved'; image: ProductImage; preview: string | null }
  | {
      key: string;
      status: 'uploading';
      blob: Blob | null;
      position: number;
      preview: string | null;
    }
  /** Produto novo que ainda não pode ser criado (faltam campos): a foto sobe ao guardar. */
  | { key: string; status: 'waiting'; blob: Blob; preview: string | null }
  | { key: string; status: 'failed'; blob: Blob; preview: string | null };

type Options = {
  storeId: string;
  initial: ProductImage[];
  /** O produto já criado (ou null, num produto novo ainda sem linha). */
  productIdRef: MutableRefObject<string | null>;
  /** Cria o produto se os campos já o permitirem; null enquanto não. */
  ensureProductId: () => Promise<string | null>;
  /** Volta a ler as fotos guardadas (depois de INVALID_ORDER). */
  reload: () => Promise<ProductImage[] | null>;
};

let keySeq = 0;
const newKey = () => `ph-${++keySeq}`;
const savedSlot = (image: ProductImage): PhotoSlot => ({
  key: image.id,
  status: 'saved',
  image,
  preview: null,
});

function sizeInMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

/** A primeira posição livre entre as guardadas e as reservadas pelos envios a decorrer. */
function freePosition(list: PhotoSlot[]): number {
  const used = new Set(
    list.flatMap((s) =>
      s.status === 'saved' ? [s.image.position] : s.status === 'uploading' ? [s.position] : [],
    ),
  );
  for (let i = 0; i < MAX_PHOTOS; i++) if (!used.has(i)) return i;
  return list.length;
}

function previewOf(blob: Blob): string | null {
  // O jsdom (e navegadores muito antigos) não têm createObjectURL.
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : null;
}

export function useProductPhotos({
  storeId,
  initial,
  productIdRef,
  ensureProductId,
  reload,
}: Options) {
  const [slots, setSlotsState] = useState<PhotoSlot[]>(() =>
    [...initial].sort((a, b) => a.position - b.position).map(savedSlot),
  );
  // As funções assíncronas leem sempre a lista mais recente.
  const slotsRef = useRef(slots);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const upload = useUploadProductImage();
  const removeImage = useRemoveProductImage();
  const setOrder = useSetProductImageOrder();

  function update(fn: (list: PhotoSlot[]) => PhotoSlot[]) {
    const next = fn(slotsRef.current);
    slotsRef.current = next;
    setSlotsState(next);
  }
  const patch = (key: string, slot: PhotoSlot) =>
    update((list) => list.map((s) => (s.key === key ? slot : s)));
  const find = (key: string) => slotsRef.current.find((s) => s.key === key);

  /** Grava a ordem das fotos guardadas; com INVALID_ORDER, relê a lista do servidor. */
  async function saveOrder(previous: PhotoSlot[]): Promise<boolean> {
    const productId = productIdRef.current;
    const saved = slotsRef.current.filter((s) => s.status === 'saved');
    if (!productId || saved.length === 0) return true;
    const ids = saved.map((s) => (s.status === 'saved' ? s.image.id : ''));
    try {
      await setOrder.mutateAsync({ productId, imageIds: ids });
    } catch (e) {
      const message = errorMessage(e);
      if (message === MESSAGES.invalidOrder) {
        const fresh = await reload().catch(() => null);
        if (fresh) {
          update((list) => [
            ...[...fresh].sort((a, b) => a.position - b.position).map(savedSlot),
            ...list.filter((s) => s.status !== 'saved'),
          ]);
        }
      } else {
        update(() => previous);
      }
      setError(message);
      return false;
    }
    update((list) =>
      list.map((s) =>
        s.status === 'saved'
          ? { ...s, image: { ...s.image, position: ids.indexOf(s.image.id) } }
          : s,
      ),
    );
    return true;
  }

  /** A principal tem de estar na posição 0 (é a que o catálogo mostra): acerta os buracos. */
  async function normalize() {
    const list = slotsRef.current;
    if (list.some((s) => s.status === 'uploading')) return;
    const saved = list.filter((s) => s.status === 'saved');
    if (saved.some((s, i) => s.status === 'saved' && s.image.position !== i)) {
      await saveOrder(list);
    }
  }

  async function send(key: string, blob: Blob, productId: string): Promise<boolean> {
    const preview = find(key)?.preview ?? null;
    const position = freePosition(slotsRef.current.filter((s) => s.key !== key));
    patch(key, { key, status: 'uploading', blob, position, preview });
    try {
      const image = await upload.mutateAsync({ storeId, productId, blob, position });
      patch(key, { key, status: 'saved', image, preview });
      const index = slotsRef.current.findIndex((s) => s.key === key);
      setAnnouncement(`Foto ${index + 1} enviada.`);
      await normalize();
      return true;
    } catch {
      patch(key, { key, status: 'failed', blob, preview });
      return false;
    }
  }

  async function pick(files: File[]) {
    setError(null);
    setAnnouncement('');
    const room = MAX_PHOTOS - slotsRef.current.length;
    let problem: string | null = files.length > room ? MESSAGES.productPhotosFull : null;
    const queued: { key: string; file: File }[] = [];
    for (const file of files.slice(0, Math.max(room, 0))) {
      const found = checkImageFile(file);
      if (found === 'format') problem = MESSAGES.imageFormat;
      else if (found === 'too_large') problem = MESSAGES.imageTooLarge(sizeInMb(file.size));
      else queued.push({ key: newKey(), file });
    }
    // Todas aparecem logo «A enviar…»; depois sobem uma a uma, pela ordem escolhida.
    update((list) => {
      const next = [...list];
      for (const q of queued) {
        next.push({
          key: q.key,
          status: 'uploading',
          blob: null,
          position: freePosition(next),
          preview: null,
        });
      }
      return next;
    });
    for (const { key, file } of queued) {
      let blob: Blob;
      try {
        blob = await compressImage(file);
      } catch {
        update((list) => list.filter((s) => s.key !== key));
        problem = MESSAGES.invalidPath;
        continue;
      }
      const preview = previewOf(blob);
      const productId = await ensureProductId();
      if (!productId) {
        patch(key, { key, status: 'waiting', blob, preview });
        continue;
      }
      patch(key, {
        key,
        status: 'uploading',
        blob,
        position: freePosition(slotsRef.current),
        preview,
      });
      await send(key, blob, productId);
    }
    if (problem) setError(problem);
  }

  async function retry(key: string) {
    const slot = find(key);
    const productId = productIdRef.current;
    if (!slot || slot.status !== 'failed' || !productId) return;
    setError(null);
    await send(key, slot.blob, productId);
  }

  /** Devolve false se o servidor recusou (por exemplo, PHOTO_REQUIRED na última foto publicada). */
  async function remove(key: string): Promise<boolean> {
    const slot = find(key);
    if (!slot || slot.status === 'uploading') return false;
    setError(null);
    setAnnouncement('');
    if (slot.status === 'saved') {
      try {
        await removeImage.mutateAsync(slot.image);
      } catch (e) {
        setError(errorMessage(e));
        return false;
      }
    }
    update((list) => list.filter((s) => s.key !== key));
    if (selectedKey === key) setSelectedKey(null);
    await normalize();
    return true;
  }

  /** Muda a ordem (só fotos guardadas ou à espera); grava logo se o produto já existe. */
  async function move(key: string, to: number) {
    const list = slotsRef.current;
    const from = list.findIndex((s) => s.key === key);
    if (from <= 0 || to < 0 || to >= from) return;
    setError(null);
    const next = [...list];
    const [slot] = next.splice(from, 1);
    next.splice(to, 0, slot!);
    update(() => next);
    await saveOrder(list);
  }

  /** Sobe as fotos à espera para o produto acabado de criar. False se alguma falhou. */
  async function uploadWaiting(productId: string): Promise<boolean> {
    let ok = true;
    for (const slot of slotsRef.current) {
      if (slot.status === 'waiting') ok = (await send(slot.key, slot.blob, productId)) && ok;
    }
    return ok;
  }

  const savedImages = slots.flatMap((s) => (s.status === 'saved' ? [s.image] : []));
  return {
    slots,
    selectedKey,
    select: (key: string | null) => setSelectedKey((k) => (k === key ? null : key)),
    error,
    setError,
    announcement,
    pick,
    retry,
    remove,
    move,
    uploadWaiting,
    uploading: slots.some((s) => s.status === 'uploading'),
    /** Fotos que contam para publicar: guardadas ou à espera de subir. */
    count: slots.filter((s) => s.status === 'saved' || s.status === 'waiting').length,
    savedImages,
  };
}

export type ProductPhotosState = ReturnType<typeof useProductPhotos>;

const tileClass =
  'relative flex aspect-square min-w-0 items-center justify-center rounded-md border-2 border-ink bg-brand-tint text-ink-muted';
// Alvo de 44 px à volta do botão de 32 px.
const removeClass = cn(
  'absolute -top-2.5 -right-2.5 z-10 flex size-8 items-center justify-center rounded-full border-2 border-ink bg-surface p-0 text-ink',
  'cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] active:bg-brand-tint',
  'after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2',
  focusRing,
);
const peerRing =
  'peer-focus-visible:outline-solid peer-focus-visible:outline-[length:var(--focus-ring-width)] peer-focus-visible:outline-offset-[var(--focus-ring-offset)] peer-focus-visible:outline-[color:var(--focus-ring)]';

export function ProductPhotos({ photos }: { photos: ProductPhotosState }) {
  const ids = { label: useId(), hint: useId(), error: useId() };
  const inputRef = useRef<HTMLInputElement>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());
  const moveRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  // Para onde vai o foco depois de uma ação que tira de cena o controlo premido.
  const focusNext = useRef<string | null>(null);
  // Só serve para voltar a desenhar depois de pedir o foco (o efeito corre a seguir).
  const [, setFocusTick] = useState(0);
  function requestFocus(target: string) {
    focusNext.current = target;
    setFocusTick((t) => t + 1);
  }
  const { slots, selectedKey } = photos;
  const full = slots.length >= MAX_PHOTOS;
  const selectedIndex = slots.findIndex((s) => s.key === selectedKey);
  const selectable = (s: PhotoSlot) => s.status === 'saved' || s.status === 'waiting';

  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    const lastKey = slots[slots.length - 1]?.key ?? '';
    const fallback = inputRef.current ?? tileRefs.current.get(lastKey);
    if (target === 'last') {
      if (!inputRef.current) tileRefs.current.get(lastKey)?.focus();
    } else if (target === 'grid') gridRef.current?.focus();
    else if (target === 'input') fallback?.focus();
    else if (target === 'move') {
      (moveRef.current ?? tileRefs.current.get(selectedKey ?? ''))?.focus();
    } else (tileRefs.current.get(target) ?? fallback)?.focus();
  });

  function afterMove(key: string, to: number) {
    // Na primeira posição, os botões saem: o foco passa para a foto, que diz «principal».
    requestFocus(to === 0 ? key : 'move');
    void photos.move(key, to);
  }

  async function handleRemove(key: string) {
    const index = slots.findIndex((s) => s.key === key);
    const ok = await photos.remove(key);
    if (!ok) return;
    // O botão premido saiu com a foto: o foco passa para a vizinha, ou para «Juntar foto».
    const after = slots.filter((s) => s.key !== key);
    const next = after[index] ?? after[index - 1];
    requestFocus(next && selectable(next) ? next.key : 'input');
  }

  async function handlePick(files: File[]) {
    const fills = slots.length + files.length >= MAX_PHOTOS;
    // Os lugares «A enviar…» entram já e, cheia a grelha, «Juntar foto» (que tem o foco) sai
    // logo: o foco passa para a grelha, que fica, e não para o <body>.
    if (fills) requestFocus('grid');
    await photos.pick(files);
    // No fim, para a última foto (se já for um botão; senão, fica na grelha).
    if (fills) requestFocus('last');
  }

  const hint =
    slots.length >= 2
      ? 'Até 5 fotos, JPG, PNG ou WebP. Toca numa foto para a tornar principal.'
      : 'Até 5 fotos, JPG, PNG ou WebP.';

  return (
    <div className="flex flex-col gap-1.5">
      <span id={ids.label} className="font-display text-label font-bold text-ink uppercase">
        Fotos
      </span>
      {/* Focável só por código: recebe o foco quando «Juntar foto» sai de cena. */}
      <ul
        ref={gridRef}
        tabIndex={-1}
        aria-labelledby={ids.label}
        className={cn('m-0 grid list-none grid-cols-3 gap-2.5 rounded-md p-0', focusRing)}
      >
        {slots.map((slot, i) => {
          const name = `Foto ${i + 1}${i === 0 ? ', principal' : ''}`;
          const src =
            slot.status === 'saved'
              ? (slot.preview ?? publicImageUrl('product-media', slot.image.path))
              : slot.preview;
          return (
            <li key={slot.key} className="relative min-w-0">
              {selectable(slot) ? (
                <button
                  ref={(el) => {
                    if (el) tileRefs.current.set(slot.key, el);
                    else tileRefs.current.delete(slot.key);
                  }}
                  type="button"
                  aria-label={name}
                  aria-pressed={slot.key === selectedKey}
                  onClick={() => photos.select(slot.key)}
                  className={cn(
                    tileClass,
                    'w-full cursor-pointer overflow-hidden p-0 touch-manipulation [-webkit-tap-highlight-color:transparent]',
                    'aria-pressed:shadow-hard-sm aria-pressed:outline-solid aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-ink',
                    focusRing,
                  )}
                >
                  {src ? (
                    <img src={src} alt="" className="block size-full object-cover" />
                  ) : (
                    <ImageIcon aria-hidden="true" className="size-6" />
                  )}
                  {i === 0 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        tagClass.neutral,
                        'absolute bottom-1 left-1 min-h-0 px-1.25 py-px',
                      )}
                    >
                      Principal
                    </span>
                  )}
                </button>
              ) : slot.status === 'uploading' ? (
                <div role="status" className={tileClass}>
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-md bg-surface/80 font-body text-small font-bold text-ink">
                    <span
                      aria-hidden="true"
                      className="size-[18px] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none motion-reduce:border-dotted motion-reduce:border-r-current"
                    />
                    A enviar…
                  </span>
                </div>
              ) : (
                <div
                  role="alert"
                  className={cn(tileClass, 'flex-col gap-1 bg-danger-tint p-1.5 text-center')}
                >
                  <span className="font-body text-small font-medium text-ink">Não enviada</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="min-h-11 px-0 text-[13px] leading-4"
                    onClick={() => void photos.retry(slot.key)}
                  >
                    Tentar outra vez
                  </Button>
                </div>
              )}
              {slot.status !== 'uploading' && (
                <button
                  type="button"
                  aria-label={`Remover foto ${i + 1}`}
                  onClick={() => void handleRemove(slot.key)}
                  className={removeClass}
                >
                  <X aria-hidden="true" className="size-4.5" />
                </button>
              )}
            </li>
          );
        })}
        {!full && (
          <li className="min-w-0">
            <input
              ref={inputRef}
              id={`${ids.label}-input`}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="peer sr-only"
              aria-describedby={cn(ids.hint, photos.error && ids.error)}
              aria-invalid={photos.error ? true : undefined}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                // O mesmo ficheiro pode voltar a ser escolhido depois de um erro.
                e.target.value = '';
                if (files.length > 0) void handlePick(files);
              }}
            />
            <label
              htmlFor={`${ids.label}-input`}
              className={cn(
                'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-ink bg-brand-tint p-2 text-center text-ink',
                'touch-manipulation [-webkit-tap-highlight-color:transparent]',
                peerRing,
              )}
            >
              <Plus aria-hidden="true" className="size-6" />
              <span className="font-body text-small font-medium">Juntar foto</span>
            </label>
          </li>
        )}
      </ul>
      <p id={ids.hint} className="m-0 font-body text-caption font-medium text-ink-muted">
        {hint}
      </p>

      {selectedIndex > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => selectedKey && afterMove(selectedKey, 0)}
          >
            Tornar principal
          </Button>
          <Button
            ref={moveRef}
            variant="secondary"
            size="sm"
            aria-label={`Mover foto ${selectedIndex + 1} para a esquerda`}
            onClick={() => selectedKey && afterMove(selectedKey, selectedIndex - 1)}
          >
            Mover para a esquerda
          </Button>
        </div>
      )}

      {photos.error && (
        <div id={ids.error} role="alert">
          <FieldError>{photos.error}</FieldError>
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {photos.announcement}
      </p>
    </div>
  );
}
