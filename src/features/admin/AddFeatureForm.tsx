// A07 · «Adicionar destaque» (a-box ao lado da lista).
// Pesquisa lojas aprovadas com listStores({ q }), escolhe uma, datas opcionais em hora de
// Luanda e uma nota interna. Valida antes da API; os erros da API aparecem num alerta.
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AuthErrorAlert, errorMessage } from '@/features/auth/AuthErrorAlert';
import { listStores } from '@/features/catalog/api';
import { catalogKeys } from '@/features/catalog/queries';
import { MAX_QUERY_LENGTH } from '@/features/catalog/search-params';
import type { StoreSummary } from '@/features/catalog/types';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { currentUserId } from '@/features/auth/AuthProvider';
import { cn, focusRing } from '@/lib/utils';
import { saveFeature } from './api';
import { invalidateFeatures } from './queries';

import {
  NOTE_MAX,
  noteLength,
  parseFeatureDates,
  validateFeature,
  type FeatureErrors,
} from './validate';

const SEARCH_DELAY_MS = 300;

// Modo denso da administração: contorno de 1 px, como nos quadros A01–A07.
const denseInput = 'min-h-11 border px-3 py-2';
const fieldClass = 'flex flex-col gap-1.5';
const hintClass = 'm-0 font-body text-small font-medium text-ink-muted';
const errorClass = 'm-0 font-body text-small font-bold text-danger';

type Props = {
  id: string;
  onClose: () => void;
};

export function AddFeatureForm({ id, onClose }: Props) {
  const queryClient = useQueryClient();
  const ids = {
    title: useId(),
    store: useId(),
    storeHint: useId(),
    storeError: useId(),
    start: useId(),
    startError: useId(),
    end: useId(),
    endError: useId(),
    note: useId(),
    noteHint: useId(),
    noteCount: useId(),
    noteError: useId(),
    paidHint: useId(),
  };

  const [search, setSearch] = useState('');
  const [storeId, setStoreId] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FeatureErrors>({});

  const searchRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const q = useDebouncedValue(search.trim().slice(0, MAX_QUERY_LENGTH), SEARCH_DELAY_MS);
  // listStores só devolve lojas aprovadas (leitura pública).
  const stores = useQuery({
    queryKey: catalogKeys.stores({ q }),
    queryFn: () => listStores({ q }),
    enabled: q !== '',
  });

  const save = useMutation({
    mutationFn: (v: Parameters<typeof saveFeature>[0]) => saveFeature(v),
    onMutate: () => ({ userId: currentUserId() }),
    onSuccess: async (_id, _v, context) => {
      await invalidateFeatures(queryClient);
      // Se a conta mudou a meio, a confirmação não é para quem está agora no aparelho.
      if (context.userId === currentUserId()) toast('Destaque guardado.');
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    const found = validateFeature({ storeId, position: null, start, end, note });
    setErrors(found);
    // O foco vai para o primeiro campo com erro, pela ordem do formulário.
    const firstInvalid = found.store
      ? searchRef
      : found.start
        ? startRef
        : found.end
          ? endRef
          : found.note
            ? noteRef
            : null;
    if (firstInvalid) {
      firstInvalid.current?.focus();
      return;
    }
    if (!storeId) return;
    const { startsAt, endsAt } = parseFeatureDates({ start, end });
    const trimmed = note.trim();
    save.mutate({
      storeId,
      // A base põe o novo destaque no fim da ordem dos ativos, sob o mesmo trinco das
      // outras funções de posição: duas criações ao mesmo tempo não ficam com a mesma.
      position: null,
      startsAt,
      endsAt,
      note: trimmed === '' ? null : trimmed,
    });
  }

  const count = noteLength(note);

  return (
    <section
      id={id}
      aria-labelledby={ids.title}
      className="min-w-0 flex-[1_1_340px] overflow-hidden rounded-md border border-ink bg-surface"
    >
      <div className="border-b border-ink px-4 py-3">
        <h2 id={ids.title} className="m-0 font-display text-lg leading-[22px] font-bold">
          Adicionar destaque
        </h2>
      </div>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
        <div className={fieldClass}>
          <Label htmlFor={ids.store}>Loja</Label>
          <Input
            ref={searchRef}
            id={ids.store}
            type="search"
            autoComplete="off"
            className={denseInput}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setStoreId(null);
            }}
            aria-invalid={errors.store ? true : undefined}
            aria-describedby={cn(ids.storeHint, errors.store && ids.storeError)}
          />
          <p id={ids.storeHint} className={hintClass}>
            Só aparecem lojas aprovadas.
          </p>
          {errors.store && (
            <p id={ids.storeError} className={errorClass}>
              {errors.store}
            </p>
          )}
        </div>

        <StoreResults
          query={q}
          stores={stores}
          value={storeId}
          onChange={(value) => {
            setStoreId(value);
            setErrors((e) => ({ ...e, store: undefined }));
          }}
        />

        <div className="flex flex-wrap gap-3 [&>*]:min-w-[200px] [&>*]:flex-1">
          <div className={fieldClass}>
            <Label htmlFor={ids.start}>Início (opcional)</Label>
            <Input
              ref={startRef}
              id={ids.start}
              type="datetime-local"
              className={denseInput}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              aria-invalid={errors.start ? true : undefined}
              aria-describedby={errors.start ? ids.startError : undefined}
            />
            {errors.start && (
              <p id={ids.startError} className={errorClass}>
                {errors.start}
              </p>
            )}
          </div>
          <div className={fieldClass}>
            <Label htmlFor={ids.end}>Fim (opcional)</Label>
            <Input
              ref={endRef}
              id={ids.end}
              type="datetime-local"
              className={denseInput}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              aria-invalid={errors.end ? true : undefined}
              aria-describedby={errors.end ? ids.endError : undefined}
            />
            {errors.end && (
              <p id={ids.endError} className={errorClass}>
                {errors.end}
              </p>
            )}
          </div>
        </div>
        <p className={hintClass}>Sem datas, o destaque fica no ar até o desligares ou removeres.</p>

        <div className={fieldClass}>
          <Label htmlFor={ids.note}>Nota interna (opcional)</Label>
          <textarea
            ref={noteRef}
            id={ids.note}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={cn(ids.noteHint, ids.noteCount, errors.note && ids.noteError)}
            className={cn(
              'min-h-[72px] w-full min-w-0 resize-y rounded-md border border-ink bg-surface px-3 py-2 font-body text-base text-ink',
              'aria-invalid:border-danger aria-invalid:bg-danger-tint',
              focusRing,
            )}
          />
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <p id={ids.noteHint} className={hintClass}>
              Só a equipa da administração vê esta nota.
            </p>
            <p
              id={ids.noteCount}
              className={cn(hintClass, count > NOTE_MAX && 'font-bold text-danger')}
            >
              {count} de {NOTE_MAX} caracteres
            </p>
          </div>
          {errors.note && (
            <p id={ids.noteError} className={errorClass}>
              {errors.note}
            </p>
          )}
        </div>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1.5 font-display text-label font-bold text-ink uppercase">
            Origem
          </legend>
          <RadioGroup value="admin">
            <RadioGroupItem value="admin">Administração</RadioGroupItem>
            <RadioGroupItem value="paid" disabled aria-describedby={ids.paidHint}>
              Promoção paga
            </RadioGroupItem>
          </RadioGroup>
          <p id={ids.paidHint} className={hintClass}>
            Promoção paga: disponível em breve.
          </p>
        </fieldset>

        <AuthErrorAlert message={save.isError ? errorMessage(save.error) : null} />

        <div className="flex flex-wrap items-center gap-2.5">
          <Button type="submit" variant="primary" size="sm" loading={save.isPending}>
            {save.isPending ? 'A guardar…' : 'Guardar destaque'}
          </Button>
          <Button type="button" variant="link" size="sm" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
}

type StoreResultsProps = {
  query: string;
  stores: UseQueryResult<StoreSummary[]>;
  value: string | null;
  onChange: (value: string) => void;
};

function StoreResults({ query, stores, value, onChange }: StoreResultsProps) {
  if (query === '') return null;
  if (stores.isPending) {
    return (
      <p role="status" className={hintClass}>
        A procurar lojas…
      </p>
    );
  }
  if (stores.isError) return <AuthErrorAlert message={errorMessage(stores.error)} />;
  if (stores.data.length === 0) {
    return (
      <p role="status" className={hintClass}>
        Não encontrámos lojas aprovadas com esse nome.
      </p>
    );
  }
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="sr-only">Resultados da pesquisa de lojas</legend>
      <RadioGroup value={value ?? ''} onValueChange={onChange}>
        {stores.data.map((s) => (
          <RadioGroupItem key={s.id} value={s.id}>
            {s.name}
          </RadioGroupItem>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
