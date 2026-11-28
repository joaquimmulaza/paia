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
  /** Erro vindo do formulário (por exemplo, o logótipo em falta ao enviar). */
  error?: string;
  bucket?: 'store-media' | 'product-media';
};

type State =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'failed'; message: string; retry: Blob | null };

function sizeInMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

export function ImagePicker({
  label,
  value,
  onPick,
  onRemove,
  required,
  optional,
  hint,
  shortLabel,
  error,
  bucket = 'store-media',
}: ImagePickerProps) {
  const ids = { label: useId(), hint: useId(), error: useId() };
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: 'idle' });
  // Pré-visualização local enquanto a imagem pública ainda não foi pedida.
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    return () => {
      if (preview && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function send(blob: Blob) {
    setState({ status: 'uploading' });
    try {
      await onPick(blob);
      // O jsdom (e navegadores muito antigos) não têm createObjectURL: fica a imagem pública.
      if (typeof URL.createObjectURL === 'function') setPreview(URL.createObjectURL(blob));
      setState({ status: 'idle' });
    } catch (e) {
      if (e instanceof PickCancelled) {
        setState({ status: 'idle' });
        return;
      }
      const message = e instanceof Error && e.message ? e.message : MESSAGES.uploadFailed;
      setState({
        status: 'failed',
        message: message === MESSAGES.generic ? MESSAGES.uploadFailed : message,
        retry: blob,
      });
    }
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // O mesmo ficheiro pode voltar a ser escolhido depois de um erro.
    event.target.value = '';
    if (!file) return;
    const problem = checkImageFile(file);
    if (problem === 'format') {
      setState({ status: 'failed', message: MESSAGES.imageFormat, retry: null });
      return;
    }
    if (problem === 'too_large') {
      setState({
        status: 'failed',
        message: MESSAGES.imageTooLarge(sizeInMb(file.size)),
        retry: null,
      });
      return;
    }
    setState({ status: 'uploading' });
    let blob: Blob;
    try {
      blob = await compressImage(file);
    } catch {
      setState({ status: 'failed', message: MESSAGES.invalidPath, retry: null });
      return;
    }
    await send(blob);
  }

  const failed = state.status === 'failed';
  const shownError = failed ? state.message : error;
  const src = value ? (preview ?? publicImageUrl(bucket, value)) : null;

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="sr-only"
      aria-labelledby={ids.label}
      aria-describedby={cn(hint && !failed && ids.hint, shownError && ids.error) || undefined}
      aria-invalid={shownError ? true : undefined}
      aria-required={required || undefined}
      disabled={state.status === 'uploading'}
      onChange={(e) => void handleChange(e)}
    />
  );

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

      {state.status === 'uploading' && (
        <div
          role="status"
          className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-md border-2 border-ink bg-surface p-2.5"
        >
          <span
            aria-hidden="true"
            className="flex size-18 items-center justify-center rounded-md border-2 border-ink bg-brand-tint text-ink-muted"
          >
            <ImageIcon className="size-6" />
          </span>
          <div className="flex flex-col gap-1.5">
            <p className="m-0 font-body text-body font-bold">A enviar a imagem…</p>
            <div
              aria-hidden="true"
              className="h-2 overflow-hidden rounded-full border border-ink bg-surface"
            >
              <span className="block h-full w-3/5 bg-brand" />
            </div>
            <p className="m-0 font-body text-small font-medium text-ink-muted">
              Reduzimos a foto antes de enviar, para poupar dados.
            </p>
          </div>
          {input}
        </div>
      )}

      {state.status !== 'uploading' && src && !failed && (
        <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-md border-2 border-ink bg-surface p-2.5">
          <img
            src={src}
            alt={`${shortLabel ?? label} escolhido`}
            className="block size-18 rounded-md border-2 border-ink object-cover"
          />
          <div className="flex flex-col items-start gap-1">
            <p className="m-0 font-body text-body font-bold">{shortLabel ?? label}</p>
            <div className="flex flex-wrap items-center gap-3.5">
              <Button
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
                    onRemove();
                  }}
                >
                  Remover
                </Button>
              )}
            </div>
          </div>
          {input}
        </div>
      )}

      {state.status !== 'uploading' && (!src || failed) && (
        <label
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-ink p-4 text-center text-ink',
            'touch-manipulation [-webkit-tap-highlight-color:transparent]',
            'has-focus-visible:outline-solid has-focus-visible:outline-[length:var(--focus-ring-width)] has-focus-visible:outline-offset-[var(--focus-ring-offset)] has-focus-visible:outline-[color:var(--focus-ring)]',
            shownError ? 'min-h-24 bg-danger-tint' : 'min-h-[120px] bg-brand-tint',
            !hint && !shownError && 'min-h-[88px]',
          )}
        >
          {input}
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

      {shownError && state.status !== 'uploading' && (
        <p
          id={ids.error}
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
    </div>
  );
}
