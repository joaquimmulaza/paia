// Ecrã V02c · Editar loja (aprovada). Grava com saveMyStore, com os valores atuais; o endereço
// fica só de leitura e o logótipo troca-se, mas não se remove. Os erros são os do V02b.
import { useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
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
import { MESSAGES } from '@/lib/errors';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn } from '@/lib/utils';
import { useApprovedStore } from './components/approved-store';
import {
  CategorySelect,
  controlClass,
  describe,
  FieldError,
  fieldClass,
  hintClass,
} from './components/form-ui';
import { ImagePicker } from './components/ImagePicker';
import { BackLink, Notice } from './components/seller-ui';
import { useSaveMyStore, useUploadStoreImage } from './queries';
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

const header = (
  <AppHeader start={<BackLink to="/vender/loja" label="Voltar ao painel" />} title="Editar loja" />
);

export function StoreEditPage() {
  useDocumentTitle('Editar loja');
  const { store, gate } = useApprovedStore(header);
  if (!store) return gate;
  return (
    <PageShell header={header} className="gap-4.5">
      <p className="m-0 font-body text-body-lg">
        As alterações aparecem logo na loja. Não precisam de nova análise.
      </p>
      <EditForm store={store} />
    </PageShell>
  );
}

function EditForm({ store }: { store: MyStore }) {
  const categories = useCategories();
  const save = useSaveMyStore();
  const upload = useUploadStoreImage();
  const ids = {
    name: useId(),
    nameCount: useId(),
    nameError: useId(),
    slugLabel: useId(),
    description: useId(),
    descriptionError: useId(),
    category: useId(),
    categoryError: useId(),
  };

  const [values, setValues] = useState<StoreFormValues>(() => ({
    name: store.name,
    description: store.description,
    categoryId: store.categoryId,
    logoPath: store.logoPath,
    coverPath: store.coverPath,
  }));
  const [errors, setErrors] = useState<StoreErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  // Logótipo ou capa ainda a comprimir ou a enviar: guardar agora gravaria o caminho antigo.
  const [uploading, setUploading] = useState({ logo: false, cover: false });
  const refs = {
    name: useRef<HTMLInputElement>(null),
    description: useRef<HTMLTextAreaElement>(null),
    categoryId: useRef<HTMLSelectElement>(null),
  };

  function set<K extends keyof StoreFormValues>(key: K, value: StoreFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function pickFor(kind: 'logo' | 'cover') {
    return async (blob: Blob) => {
      const path = await upload.mutateAsync({ storeId: store.id, kind, blob });
      set(kind === 'logo' ? 'logoPath' : 'coverPath', path);
      return path;
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    setServerError(null);
    if (uploading.logo || uploading.cover) {
      setServerError(MESSAGES.storeImagesUploading);
      return;
    }
    // A loja aprovada não perde o que o envio exigiu: valida como no envio.
    const found = validateStore(values, 'submit');
    setErrors(found);
    const first = STORE_FIELDS.find((f) => found[f]);
    if (first) {
      if (first !== 'logoPath') refs[first].current?.focus();
      return;
    }
    const userId = currentUserId();
    try {
      await save.mutateAsync({
        ...values,
        name: values.name.trim(),
        description: values.description.trim(),
      });
    } catch (error) {
      setServerError(errorMessage(error));
      return;
    }
    if (userId === currentUserId()) {
      toast.success('Alterações guardadas.', { duration: TOAST_MS });
    }
  }

  return (
    <form noValidate onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4.5">
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
          aria-describedby={describe(ids.nameCount, errors.name && ids.nameError)}
        />
        <p id={ids.nameCount} className={hintClass}>
          {charCount(values.name)} de {STORE_NAME_MAX} caracteres.
        </p>
        {errors.name && <FieldError id={ids.nameError}>{errors.name}</FieldError>}
      </div>

      <div role="group" aria-labelledby={ids.slugLabel} className={fieldClass}>
        <span id={ids.slugLabel} className="font-display text-label font-bold text-ink uppercase">
          Endereço da loja
        </span>
        <p className="m-0 flex min-h-[52px] items-center rounded-md border-2 border-ink bg-paper px-4 py-3 font-body text-base break-all text-ink">
          …/loja/{store.slug}
        </p>
        <p className={hintClass}>
          O endereço não muda depois de a loja ser aprovada, para não quebrar as ligações que já
          partilhaste.
        </p>
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

      {/* Obrigatório: troca-se, mas não se remove (sem onRemove). */}
      <ImagePicker
        label="Logótipo"
        value={values.logoPath}
        onPick={pickFor('logo')}
        onUploadingChange={(busy) => setUploading((u) => ({ ...u, logo: busy }))}
        error={errors.logoPath}
        required
      />
      <ImagePicker
        label="Imagem de capa"
        feminine
        value={values.coverPath}
        onPick={pickFor('cover')}
        onUploadingChange={(busy) => setUploading((u) => ({ ...u, cover: busy }))}
        onRemove={() => set('coverPath', null)}
        optional
      />

      <div className="flex flex-col gap-3.5">
        <Button type="submit" variant="primary" className="w-full" loading={save.isPending}>
          {save.isPending ? 'A guardar…' : 'Guardar alterações'}
        </Button>
        <Button asChild variant="link" className="self-center">
          <Link to="/vender/loja">Cancelar</Link>
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
