// V02b · imagem da loja (d-upload, v-img): escolher, a enviar, enviado, falhou.
// Verifica o original (JPG, PNG ou WebP até 15 MB), comprime para WebP e passa o resultado a
// `onPick`, que o envia e devolve o caminho. Reutilizado na edição da loja (Task 6).
import { CircleAlert, ImageIcon, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { publicImageUrl } from '@/features/catalog/labels';
import { MESSAGES } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { checkImageFile, compressImage } from '../images';

/** `onPick` lança isto quando não deve haver aviso de falha (por exemplo, faltam o nome e a categoria e esses campos já mostram o erro). */
export class PickCancelled extends Error {
  constructor() {
    super('pick_cancelled');
  }
}

type ImagePickerProps = {
  label: string;
  /** O caminho da imagem guardada (no bucket `bucket`), ou null. */
  value: string | null;
  /** Recebe a imagem já comprimida, envia-a e devolve o caminho. */
  onPick: (blob: Blob) => Promise<string>;
  onRemove?: () => void;
  required?: boolean;
  /** Mostra «(opcional)» a seguir ao rótulo. */
  optional?: boolean;
  /** Texto curto por baixo de «Escolher imagem». */
  hint?: string;
  /** Nome curto do cartão depois de escolhida (por omissão, o rótulo). */
  shortLabel?: string;
  /** O nome é feminino («Imagem de capa»): «escolhida», «enviada». */
  feminine?: boolean;
  /** Erro vindo do formulário (por exemplo, o logótipo em falta ao enviar). */
  error?: string;
  bucket?: 'store-media' | 'product-media';
  /** Avisa quando começa e acaba de preparar e enviar uma imagem (compressão incluída). */
  onUploadingChange?: (uploading: boolean) => void;
};

type State =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'failed'; message: string; retry: Blob | null };

function sizeInMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

// O anel de foco do input escondido aparece no cartão visível logo a seguir (peer).
const peerRing =
  'peer-focus-visible:outline-solid peer-focus-visible:outline-[length:var(--focus-ring-width)] peer-focus-visible:outline-offset-[var(--focus-ring-offset)] peer-focus-visible:outline-[color:var(--focus-ring)]';

const UPLOADING = 'A enviar a imagem…';

export function ImagePicker({
  label,
  value,
  onPick,
  onRemove,
  required,
  optional,
  hint,
  shortLabel,
  feminine = false,
  error,
  bucket = 'store-media',
  onUploadingChange,
}: ImagePickerProps) {
  const ids = { label: useId(), hint: useId(), error: useId(), input: useId() };
  const inputRef = useRef<HTMLInputElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<State>({ status: 'idle' });
  // O que o leitor de ecrã ouve: uma região aria-live sempre montada.
  const [announcement, setAnnouncement] = useState('');
  // Depois de um envio bem-sucedido, o foco passa para «Trocar» quando ele aparecer.
  const focusChange = useRef(false);
  // Pré-visualização local enquanto a imagem pública ainda não foi pedida.
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    return () => {
      if (preview && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const name = shortLabel ?? label;
  const failed = state.status === 'failed';
  const uploading = state.status === 'uploading';
  const shownError = failed ? state.message : error;
  const src = value ? (preview ?? publicImageUrl(bucket, value)) : null;
  const done = !uploading && !failed && src !== null;

  const onUploadingRef = useRef(onUploadingChange);
  onUploadingRef.current = onUploadingChange;
  useEffect(() => {
    onUploadingRef.current?.(uploading);
  }, [uploading]);

  useEffect(() => {
    if (done && focusChange.current) {
      focusChange.current = false;
      changeRef.current?.focus();
    }
  });

  function fail(message: string, retry: Blob | null) {
    setAnnouncement('');
    setState({ status: 'failed', message, retry });
    // O cartão com «Trocar» pode ter saído: o foco volta ao campo, não cai no <body>.
    inputRef.current?.focus();
  }

  async function send(blob: Blob) {
    setState({ status: 'uploading' });
    setAnnouncement(UPLOADING);
    try {
      await onPick(blob);
      // O jsdom (e navegadores muito antigos) não têm createObjectURL: fica a imagem pública.
      if (typeof URL.createObjectURL === 'function') setPreview(URL.createObjectURL(blob));
      focusChange.current = true;
      setAnnouncement(`${name} ${feminine ? 'enviada' : 'enviado'}.`);
      setState({ status: 'idle' });
    } catch (e) {
      if (e instanceof PickCancelled) {
        setAnnouncement('');
        setState({ status: 'idle' });
        return;
      }
      const message = e instanceof Error && e.message ? e.message : MESSAGES.uploadFailed;
      fail(message === MESSAGES.generic ? MESSAGES.uploadFailed : message, blob);
    }
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // O mesmo ficheiro pode voltar a ser escolhido depois de um erro.
    event.target.value = '';
    if (!file || uploading) return;
    const problem = checkImageFile(file);
    if (problem === 'format') return fail(MESSAGES.imageFormat, null);
    if (problem === 'too_large') return fail(MESSAGES.imageTooLarge(sizeInMb(file.size)), null);
    setState({ status: 'uploading' });
    setAnnouncement(UPLOADING);
    let blob: Blob;
    try {
      blob = await compressImage(file);
    } catch {
      return fail(MESSAGES.invalidPath, null);
    }
    await send(blob);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={ids.label} className="font-display text-label font-bold text-ink uppercase">
        {label}
        {optional && (
          <span className="font-body font-medium tracking-normal text-ink-muted normal-case">
            {' '}
            (opcional)
          </span>
        )}
      </span>

      {/* Um só input, sempre montado: o foco não se perde ao mudar de estado. Durante o envio
          fica ativo (desativado perderia o foco) e ignora novas escolhas. Com a imagem
          escolhida sai da ordem do Tab: o controlo passa a ser «Trocar». */}
      <input
        ref={inputRef}
        id={ids.input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="peer sr-only"
        tabIndex={done ? -1 : undefined}
        aria-labelledby={ids.label}
        aria-describedby={
          cn(hint && !failed && !done && ids.hint, shownError && ids.error) || undefined
        }
        aria-invalid={shownError ? true : undefined}
        aria-required={required || undefined}
        aria-disabled={uploading || undefined}
        onChange={(e) => void handleChange(e)}
      />

      {uploading && (
        <div
          className={cn(
            'grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-md border-2 border-ink bg-surface p-2.5',
            peerRing,
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-18 items-center justify-center rounded-md border-2 border-ink bg-brand-tint text-ink-muted"
          >
            <ImageIcon className="size-6" />
          </span>
          {/* O texto visível repete a região aria-live: escondido do leitor de ecrã. */}
          <div aria-hidden="true" className="flex flex-col gap-1.5">
            <p className="m-0 font-body text-body font-bold">{UPLOADING}</p>
            <div className="h-2 overflow-hidden rounded-full border border-ink bg-surface">
              <span className="block h-full w-3/5 bg-brand" />
            </div>
            <p className="m-0 font-body text-small font-medium text-ink-muted">
              Reduzimos a foto antes de enviar, para poupar dados.
            </p>
          </div>
        </div>
      )}

      {done && (
        <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-md border-2 border-ink bg-surface p-2.5">
          <img
            src={src}
            alt={`${name} ${feminine ? 'escolhida' : 'escolhido'}`}
            className="block size-18 rounded-md border-2 border-ink object-cover"
          />
          <div className="flex flex-col items-start gap-1">
            <p className="m-0 font-body text-body font-bold">{name}</p>
            <div className="flex flex-wrap items-center gap-3.5">
              <Button
                ref={changeRef}
                variant="link"
                size="sm"
                aria-describedby={ids.label}
                onClick={() => inputRef.current?.click()}
              >
                Trocar
              </Button>
              {onRemove && (
                <Button
                  variant="link"
                  size="sm"
                  className="text-danger active:text-ink"
                  aria-describedby={ids.label}
                  onClick={() => {
                    setPreview(null);
                    setAnnouncement('');
                    onRemove();
                    // O cartão sai: o foco volta ao campo de escolher (já no Tab outra vez).
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                >
                  Remover
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {!uploading && !done && (
        <label
          htmlFor={ids.input}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-ink p-4 text-center text-ink',
            'touch-manipulation [-webkit-tap-highlight-color:transparent]',
            peerRing,
            shownError ? 'min-h-24 bg-danger-tint' : 'min-h-[120px] bg-brand-tint',
            !hint && !shownError && 'min-h-[88px]',
          )}
        >
          {!failed && <Upload aria-hidden="true" className="size-6" />}
          <strong className="font-display font-bold">
            {failed ? 'Escolher outra imagem' : 'Escolher imagem'}
          </strong>
          {failed ? (
            <span className="font-body text-small font-medium text-ink-muted">
              JPG, PNG ou WebP, até 15 MB.
            </span>
          ) : (
            hint && (
              <span id={ids.hint} className="font-body text-small font-medium text-ink-muted">
                {hint}
              </span>
            )
          )}
        </label>
      )}

      {shownError && !uploading && (
        <p
          id={ids.error}
          // Uma falha desta imagem anuncia-se logo; o erro do formulário já tem o resumo.
          role={failed ? 'alert' : undefined}
          className="m-0 flex items-start gap-1.5 font-body text-caption font-medium text-danger"
        >
          <CircleAlert aria-hidden="true" className="size-[18px] shrink-0" />
          <span>{shownError}</span>
        </p>
      )}

      {failed && state.retry && (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => state.retry && void send(state.retry)}
        >
          Tentar outra vez
        </Button>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
