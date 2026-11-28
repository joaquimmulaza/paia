// Ecrãs V02 · Pedido de loja e V02b · erros e envio.
// O rascunho só exige nome e categoria; para enviar, também a descrição e o logótipo.
// A loja em análise, aprovada ou suspensa não se edita aqui: segue para o ecrã do seu estado.
import { ChevronDown, CircleAlert } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { currentUserId } from '@/features/auth/AuthProvider';
import { errorMessage } from '@/features/auth/AuthErrorAlert';
import { LoadError } from '@/features/catalog/components/LoadError';
import { useCategories } from '@/features/catalog/queries';
import type { Category } from '@/features/catalog/types';
import { MESSAGES } from '@/lib/errors';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn, focusRing } from '@/lib/utils';
import { ImagePicker, PickCancelled } from './components/ImagePicker';
import {
  BackLink,
  HOME_BY_KIND,
  Notice,
  SellerSkeleton,
  useMyProfile,
} from './components/seller-ui';
import { useMyStore, useSaveMyStore, useSubmitMyStore, useUploadStoreImage } from './queries';
import { storeSlugPreview } from './slug';
import type { MyStore } from './types';
import {
  charCount,
  STORE_DESCRIPTION_MAX,
  STORE_FIELDS,
  STORE_NAME_MAX,
  validateStore,
  type StoreErrors,
  type StoreFormValues,
} from './validate';

const TOAST_MS = 4000;

export function StoreRequestPage() {
  useDocumentTitle('A tua loja');
  const profile = useMyProfile();
  const store = useMyStore();
  // O formulário monta uma só vez: depois do primeiro «Guardar», a loja passa de null a
  // rascunho, e o que está escrito não pode ser reposto.
  const [ready, setReady] = useState(false);
  const loaded = store.isSuccess && profile.isSuccess;
  useEffect(() => {
    if (loaded) setReady(true);
  }, [loaded]);

  const back = !store.data
    ? '/vender'
    : store.data.kind === 'rejected'
      ? '/vender/estado'
      : '/perfil';
  const header = <AppHeader start={<BackLink to={back} />} title="A tua loja" />;

  if (!ready) {
    if (store.isError || profile.isError) {
      const failed = store.isError ? store : profile;
      return (
        <PageShell header={header}>
          <LoadError
            error={failed.error}
            retrying={failed.isFetching}
            onRetry={() => void failed.refetch()}
          />
        </PageShell>
      );
    }
    if (!loaded) {
      return (
        <PageShell header={header}>
          <SellerSkeleton />
        </PageShell>
      );
    }
  }

  const kind = store.data?.kind ?? 'none';
  if (kind === 'pending' || kind === 'approved' || kind === 'suspended') {
    return <Navigate to={HOME_BY_KIND[kind]} replace />;
  }
  if (kind === 'none' && profile.data?.affiliation !== 'student') {
    return <Navigate to="/vender" replace />;
  }

  return (
    <PageShell header={header} className="gap-4.5">
      <p className="m-0 font-body text-body-lg">
        É isto que os compradores vão ver. Podes mudar mais tarde.
      </p>
      <StoreForm initial={store.data ?? null} saved={store.data ?? null} />
    </PageShell>
  );
}

function initialValues(store: MyStore | null): StoreFormValues {
  return {
    name: store?.name ?? '',
    description: store?.description ?? '',
    categoryId: store?.categoryId ?? '',
    logoPath: store?.logoPath ?? null,
    coverPath: store?.coverPath ?? null,
  };
}

function payload(values: StoreFormValues): StoreFormValues {
  return { ...values, name: values.name.trim(), description: values.description.trim() };
}

const fieldClass = 'flex flex-col gap-1.5';
const hintClass = 'm-0 font-body text-caption font-medium text-ink-muted';
const controlClass = cn(
  'w-full min-w-0 rounded-md border-2 border-ink bg-surface px-4 py-3 font-body text-base text-ink',
  'transition-[border-color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
  'aria-invalid:border-danger aria-invalid:bg-danger-tint',
  focusRing,
);

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p
      id={id}
      className="m-0 flex items-start gap-1.5 font-body text-caption font-medium text-danger"
    >
      <CircleAlert aria-hidden="true" className="size-[18px] shrink-0" />
      <span>{children}</span>
    </p>
  );
}

type Action = 'submit' | 'draft' | null;

function StoreForm({ initial, saved }: { initial: MyStore | null; saved: MyStore | null }) {
  const navigate = useNavigate();
  const categories = useCategories();
  const save = useSaveMyStore();
  const submit = useSubmitMyStore();
  const upload = useUploadStoreImage();

  const ids = {
    summary: useId(),
    name: useId(),
    nameCount: useId(),
    nameSlug: useId(),
    nameSlugNote: useId(),
    nameError: useId(),
    description: useId(),
    descriptionError: useId(),
    category: useId(),
    categoryError: useId(),
  };

  const [values, setValues] = useState<StoreFormValues>(() => initialValues(initial));
  const [errors, setErrors] = useState<StoreErrors>({});
  // O resumo só aparece depois de um «Enviar» falhado e conta os erros que ainda se veem.
  const [showSummary, setShowSummary] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [focusSummary, setFocusSummary] = useState(0);

  // Os valores mais recentes, para as funções assíncronas da imagem (sem fecho antigo).
  const latest = useRef(values);
  latest.current = values;
  const storeIdRef = useRef<string | null>(initial?.id ?? null);
  if (saved && !storeIdRef.current) storeIdRef.current = saved.id;

  const summaryRef = useRef<HTMLDivElement>(null);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    description: useRef<HTMLTextAreaElement>(null),
    categoryId: useRef<HTMLSelectElement>(null),
  };

  useEffect(() => {
    if (focusSummary > 0) summaryRef.current?.focus();
  }, [focusSummary]);

  function set<K extends keyof StoreFormValues>(key: K, value: StoreFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function focusFirst(found: StoreErrors) {
    const first = STORE_FIELDS.find((f) => found[f]);
    if (first && first !== 'logoPath') refs[first].current?.focus();
  }

  /** Antes da primeira imagem é preciso a loja: cria o rascunho com o nome e a categoria. */
  async function ensureStoreId(): Promise<string> {
    if (storeIdRef.current) return storeIdRef.current;
    const found = validateStore(latest.current, 'draft');
    if (Object.keys(found).length > 0) {
      setErrors((e) => ({ ...e, ...found }));
      focusFirst(found);
      throw new PickCancelled();
    }
    const id = await save.mutateAsync(payload(latest.current));
    storeIdRef.current = id;
    return id;
  }

  function pickFor(kind: 'logo' | 'cover') {
    const key = kind === 'logo' ? 'logoPath' : 'coverPath';
    return async (blob: Blob) => {
      const storeId = await ensureStoreId();
      const path = await upload.mutateAsync({ storeId, kind, blob });
      const next = { ...latest.current, [key]: path };
      setValues(next);
      if (kind === 'logo') setErrors((e) => ({ ...e, logoPath: undefined }));
      // Guarda logo o caminho no rascunho, para a imagem não se perder se saíres sem guardar.
      // Se falhar, o caminho continua no formulário e vai no próximo «Guardar» ou «Enviar».
      if (Object.keys(validateStore(next, 'draft')).length === 0) {
        await save.mutateAsync(payload(next)).catch(() => undefined);
      }
      return path;
    };
  }

  async function run(mode: 'draft' | 'submit') {
    if (action) return;
    setServerError(null);
    const found = validateStore(values, mode);
    setErrors(found);
    const count = Object.keys(found).length;
    if (count > 0) {
      if (mode === 'submit') {
        setShowSummary(true);
        setFocusSummary((n) => n + 1);
      } else {
        setShowSummary(false);
        focusFirst(found);
      }
      return;
    }
    setShowSummary(false);
    setAction(mode);
    const userId = currentUserId();
    try {
      storeIdRef.current = await save.mutateAsync(payload(values));
      if (mode === 'submit') await submit.mutateAsync();
    } catch (error) {
      const message = errorMessage(error);
      const fallback = mode === 'submit' ? MESSAGES.submitFailed : MESSAGES.saveFailed;
      setServerError(message === MESSAGES.generic ? fallback : message);
      setAction(null);
      return;
    }
    setAction(null);
    // Se a conta mudou a meio, o aviso não é para quem está agora no aparelho.
    if (userId !== currentUserId()) return;
    if (mode === 'submit') {
      toast.success('Pedido enviado para análise.', { duration: TOAST_MS });
      navigate('/vender/estado', { replace: true });
    } else {
      toast.success('Rascunho guardado. Podes continuar mais tarde, em Perfil.', {
        duration: TOAST_MS,
      });
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void run('submit');
  }

  // Pré-visualização do endereço; depois de guardar, o endereço final vem da base.
  const preview = storeSlugPreview(values.name);
  const savedName = saved?.name.trim() ?? null;
  const showSaved = saved !== null && savedName === values.name.trim();
  const slug = showSaved ? saved.slug : preview || 'loja-…';
  const suffix =
    showSaved && preview && saved.slug !== preview && saved.slug.startsWith(`${preview}-`)
      ? saved.slug.slice(preview.length)
      : null;

  const missing = Object.values(errors).filter(Boolean).length;
  const describe = (...list: Array<string | false | undefined>) => cn(...list) || undefined;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4.5">
      {showSummary && missing > 0 && (
        <div
          ref={summaryRef}
          id={ids.summary}
          tabIndex={-1}
          role="alert"
          className={cn('rounded-md', focusRing)}
        >
          <Notice tone="danger">{MESSAGES.missingFields(missing)}</Notice>
        </div>
      )}

      <div className={fieldClass}>
        <Label htmlFor={ids.name}>Nome da loja</Label>
        <Input
          ref={refs.name}
          id={ids.name}
          autoComplete="off"
          maxLength={STORE_NAME_MAX}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describe(
            ids.nameCount,
            ids.nameSlug,
            suffix !== null && ids.nameSlugNote,
            errors.name && ids.nameError,
          )}
        />
        <p id={ids.nameCount} className={hintClass}>
          {charCount(values.name)} de {STORE_NAME_MAX} caracteres.
        </p>
        <p id={ids.nameSlug} className={hintClass} aria-live="polite">
          Endereço da loja: <strong className="text-ink">…/loja/{slug}</strong>
        </p>
        {suffix !== null && (
          <p id={ids.nameSlugNote} className={hintClass}>
            Já existe uma loja com este nome, por isso o endereço leva «{suffix}». O nome que os
            compradores veem continua igual.
          </p>
        )}
        {errors.name && <FieldError id={ids.nameError}>{errors.name}</FieldError>}
      </div>

      <div className={fieldClass}>
        <Label htmlFor={ids.description}>Descrição</Label>
        <textarea
          ref={refs.description}
          id={ids.description}
          rows={3}
          maxLength={STORE_DESCRIPTION_MAX}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={describe(errors.description && ids.descriptionError)}
          className={cn(controlClass, 'min-h-[104px] resize-y')}
        />
        {errors.description && (
          <FieldError id={ids.descriptionError}>{errors.description}</FieldError>
        )}
      </div>

      <div className={fieldClass}>
        <Label htmlFor={ids.category}>Categoria principal</Label>
        <CategorySelect
          selectRef={refs.categoryId}
          id={ids.category}
          categories={categories.data}
          value={values.categoryId}
          onChange={(v) => set('categoryId', v)}
          invalid={Boolean(errors.categoryId)}
          describedBy={describe(errors.categoryId && ids.categoryError)}
        />
        {categories.isError && (
          <LoadError
            error={categories.error}
            retrying={categories.isFetching}
            onRetry={() => void categories.refetch()}
          />
        )}
        {errors.categoryId && <FieldError id={ids.categoryError}>{errors.categoryId}</FieldError>}
      </div>

      <ImagePicker
        label="Logótipo ou foto da loja"
        shortLabel="Logótipo"
        hint="JPG, PNG ou WebP. Quadrada fica melhor."
        value={values.logoPath}
        onPick={pickFor('logo')}
        onRemove={() => set('logoPath', null)}
        error={errors.logoPath}
        required
      />
      <ImagePicker
        label="Imagem de capa"
        value={values.coverPath}
        onPick={pickFor('cover')}
        onRemove={() => set('coverPath', null)}
        optional
      />

      <p className="m-0 font-body text-small font-medium text-ink-muted">
        A loja mostra só o nome, a descrição e as imagens. O teu curso, turma, email e telefone não
        aparecem.
      </p>

      <div className="flex flex-col gap-3.5">
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={action === 'submit'}
          disabled={action !== null}
        >
          {action === 'submit' ? 'A enviar…' : 'Enviar para análise'}
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          loading={action === 'draft'}
          disabled={action !== null}
          onClick={() => void run('draft')}
        >
          {action === 'draft' ? 'A guardar…' : 'Guardar rascunho'}
        </Button>
      </div>

      {serverError && (
        <div role="alert">
          <Notice tone="danger">{serverError}</Notice>
        </div>
      )}
    </form>
  );
}

type CategorySelectProps = {
  id: string;
  selectRef: RefObject<HTMLSelectElement>;
  categories: Category[] | undefined;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy: string | undefined;
};

function CategorySelect({
  id,
  selectRef,
  categories,
  value,
  onChange,
  invalid,
  describedBy,
}: CategorySelectProps) {
  return (
    <div className="relative">
      <select
        ref={selectRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(controlClass, 'min-h-[52px] cursor-pointer appearance-none pr-11')}
      >
        <option value="" disabled>
          {categories ? 'Escolhe uma categoria' : 'A carregar as categorias…'}
        </option>
        {categories?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-ink"
      />
    </div>
  );
}
