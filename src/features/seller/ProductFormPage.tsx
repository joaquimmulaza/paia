// Ecrãs V06 · Novo produto e V06b · Editar produto.
// Novo: o produto é criado oculto logo que a primeira foto o permita (com os campos prontos) ou
// ao guardar; as fotos sobem para ele e, com «Publicar na loja» ligado, só então se publica.
// A base recusa publicar sem fotos e apagar a última foto de um produto publicado
// (PHOTO_REQUIRED): a mensagem aparece nas fotos.
import { ImageIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { currentUserId } from '@/features/auth/AuthProvider';
import { errorMessage } from '@/features/auth/AuthErrorAlert';
import { EmptyState } from '@/features/catalog/components/EmptyState';
import { LoadError } from '@/features/catalog/components/LoadError';
import { useCategories } from '@/features/catalog/queries';
import { MESSAGES } from '@/lib/errors';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn } from '@/lib/utils';
import { useApprovedStore } from './components/approved-store';
import { DeleteProductDialog } from './components/DeleteProductDialog';
import {
  CategorySelect,
  controlClass,
  describe,
  FieldError,
  fieldClass,
  hintClass,
} from './components/form-ui';
import { ProductPhotos, useProductPhotos } from './components/ProductPhotos';
import { BackLink, Notice, SellerSkeleton } from './components/seller-ui';
import { useCreateProduct, useDeleteProduct, useMyProduct, useUpdateProduct } from './queries';
import type { MyProductDetail, MyStore, ProductInput } from './types';
import {
  parseWhole,
  PRODUCT_DESCRIPTION_MAX,
  PRODUCT_FIELDS,
  PRODUCT_NAME_MAX,
  validateProduct,
  type ProductErrors,
  type ProductFormValues,
} from './validate';

const TOAST_MS = 4000;
const LIST = '/vender/produtos';

export function ProductFormPage() {
  const { id = '' } = useParams();
  const title = id ? 'Editar produto' : 'Novo produto';
  useDocumentTitle(title);
  const header = (
    <AppHeader start={<BackLink to={LIST} label="Voltar aos produtos" />} title={title} />
  );
  const { store, gate } = useApprovedStore(header);
  if (!store) return gate;
  return (
    <PageShell header={header} className="gap-4">
      {id ? (
        <EditProduct key={id} store={store} id={id} />
      ) : (
        <ProductForm store={store} product={null} reload={async () => null} />
      )}
    </PageShell>
  );
}

function EditProduct({ store, id }: { store: MyStore; id: string }) {
  const product = useMyProduct(store.id, id);
  // O formulário monta uma só vez: as releituras depois de cada mutação não repõem o que está
  // escrito (nem o fazem desaparecer depois de apagar, antes de sair do ecrã).
  const [initial, setInitial] = useState<MyProductDetail | null>(null);
  useEffect(() => {
    if (product.data && !initial) setInitial(product.data);
  }, [product.data, initial]);

  if (initial) {
    return (
      <ProductForm
        store={store}
        product={initial}
        reload={async () => (await product.refetch()).data?.images ?? null}
      />
    );
  }
  if (product.isError) {
    return (
      <LoadError
        error={product.error}
        retrying={product.isFetching}
        onRetry={() => void product.refetch()}
      />
    );
  }
  if (product.isSuccess && !product.data) {
    return (
      <EmptyState
        icon={ImageIcon}
        title={MESSAGES.notFound}
        text="Volta à lista e escolhe outro produto."
        action={
          <Button asChild variant="secondary">
            <Link to={LIST}>Voltar aos produtos</Link>
          </Button>
        }
      />
    );
  }
  return <SellerSkeleton label="A carregar o produto…" />;
}

function toValues(store: MyStore, product: MyProductDetail | null): ProductFormValues {
  if (!product) {
    return {
      name: '',
      description: '',
      categoryId: store.categoryId,
      price: '',
      stock: '',
      publish: true,
    };
  }
  return {
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    price: String(product.priceKz),
    stock: String(product.stock),
    publish: product.isPublished,
  };
}

/** Os campos já validados, como a base os quer. */
function fieldsOf(values: ProductFormValues): Omit<ProductInput, 'storeId'> {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    categoryId: values.categoryId,
    priceKz: parseWhole(values.price) ?? 0,
    stock: parseWhole(values.stock) ?? 0,
  };
}

type ProductFormProps = {
  store: MyStore;
  /** null: produto novo. */
  product: MyProductDetail | null;
  reload: () => Promise<MyProductDetail['images'] | null>;
};

function ProductForm({ store, product, reload }: ProductFormProps) {
  const isNew = product === null;
  const navigate = useNavigate();
  const categories = useCategories();
  const create = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const ids = {
    name: useId(),
    nameError: useId(),
    description: useId(),
    category: useId(),
    categoryError: useId(),
    price: useId(),
    priceError: useId(),
    stock: useId(),
    stockHint: useId(),
    stockError: useId(),
    publish: useId(),
    publishHint: useId(),
  };
  const refs = {
    name: useRef<HTMLInputElement>(null),
    categoryId: useRef<HTMLSelectElement>(null),
    price: useRef<HTMLInputElement>(null),
    stock: useRef<HTMLInputElement>(null),
  };

  const [values, setValues] = useState<ProductFormValues>(() => toValues(store, product));
  const latest = useRef(values);
  latest.current = values;
  const [errors, setErrors] = useState<ProductErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // O produto (já criado, ou a ser criado): um só createProduct, mesmo com várias fotos.
  const productIdRef = useRef<string | null>(product?.id ?? null);
  const creating = useRef<Promise<string> | null>(null);

  function createNow(): Promise<string> {
    creating.current ??= create
      .mutateAsync({ storeId: store.id, ...fieldsOf(latest.current) })
      .then((id) => {
        productIdRef.current = id;
        return id;
      })
      .finally(() => {
        creating.current = null;
      });
    return creating.current;
  }

  const photos = useProductPhotos({
    storeId: store.id,
    initial: product?.images ?? [],
    productIdRef,
    // Com os campos prontos, a primeira foto cria o produto (oculto); sem eles, a foto espera.
    ensureProductId: async () => {
      if (productIdRef.current) return productIdRef.current;
      if (Object.keys(validateProduct(latest.current)).length > 0) return null;
      return createNow().catch(() => null);
    },
    reload,
  });

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function showServerError(error: unknown) {
    const message = errorMessage(error);
    if (message === MESSAGES.photoRequired) photos.setError(message);
    else if (message === MESSAGES.categoryNotFound) {
      setErrors((e) => ({ ...e, categoryId: message }));
      refs.categoryId.current?.focus();
    } else setNotice(message);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setNotice(null);
    if (photos.uploading) {
      setNotice(MESSAGES.productPhotosUploading);
      return;
    }
    const found = validateProduct(values);
    setErrors(found);
    const needsPhoto = values.publish && photos.count === 0;
    photos.setError(needsPhoto ? MESSAGES.photoRequired : null);
    const first = PRODUCT_FIELDS.find((f) => found[f]);
    if (first) {
      refs[first].current?.focus();
      return;
    }
    if (needsPhoto) return;

    setSaving(true);
    const userId = currentUserId();
    const fields = fieldsOf(values);
    const wasPublished = product?.isPublished ?? false;
    try {
      let productId = productIdRef.current;
      // Criado agora, já leva os campos; criado antes (pela primeira foto), leva-os no fim.
      const createdNow = productId === null;
      if (productId === null) productId = await createNow();
      if (!(await photos.uploadWaiting(productId))) {
        setNotice(MESSAGES.uploadFailed);
        setSaving(false);
        return;
      }
      const input = {
        ...(createdNow ? {} : fields),
        ...(isNew
          ? values.publish
            ? { isPublished: true }
            : {}
          : { isPublished: values.publish }),
      };
      // Criado agora e guardado oculto, não há mais nada a mudar.
      if (Object.keys(input).length > 0) {
        await updateMutation.mutateAsync({ id: productId, input });
      }
    } catch (error) {
      showServerError(error);
      setSaving(false);
      return;
    }
    setSaving(false);
    if (userId !== currentUserId()) return;
    const message =
      values.publish && !wasPublished
        ? 'Produto publicado.'
        : isNew
          ? 'Produto guardado.'
          : 'Alterações guardadas.';
    toast.success(message, { duration: TOAST_MS });
    navigate(LIST);
  }

  async function cancelNew() {
    // Só «Cancelar» apaga o produto que a primeira foto criou; sair de outra forma deixa-o oculto.
    const productId = productIdRef.current ?? (await creating.current?.catch(() => null));
    if (productId) {
      await deleteMutation
        .mutateAsync({ id: productId, imagePaths: photos.savedImages.map((i) => i.path) })
        .catch(() => undefined);
    }
    navigate(LIST);
  }

  const busy = saving || deleteMutation.isPending;
  const submitLabel = saving
    ? 'A guardar…'
    : !isNew
      ? 'Guardar alterações'
      : values.publish
        ? 'Publicar produto'
        : 'Guardar produto';

  return (
    <form noValidate onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4.5">
      <ProductPhotos photos={photos} />

      <div className={fieldClass}>
        <Label htmlFor={ids.name}>Nome</Label>
        <Input
          ref={refs.name}
          id={ids.name}
          autoComplete="off"
          maxLength={PRODUCT_NAME_MAX}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describe(errors.name && ids.nameError)}
        />
        {errors.name && <FieldError id={ids.nameError}>{errors.name}</FieldError>}
      </div>

      <div className={fieldClass}>
        <Label htmlFor={ids.description}>Descrição</Label>
        <textarea
          id={ids.description}
          rows={3}
          maxLength={PRODUCT_DESCRIPTION_MAX}
          placeholder="O que é, tamanho, ingredientes ou material."
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          className={cn(controlClass, 'min-h-[104px] resize-y')}
        />
      </div>

      <div className={fieldClass}>
        <Label htmlFor={ids.category}>Categoria</Label>
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

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3">
          <div className={fieldClass}>
            <Label htmlFor={ids.price}>Preço (Kz)</Label>
            <Input
              ref={refs.price}
              id={ids.price}
              inputMode="numeric"
              autoComplete="off"
              maxLength={11}
              value={values.price}
              onChange={(e) => set('price', e.target.value)}
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={describe(errors.price && ids.priceError)}
            />
          </div>
          <div className={fieldClass}>
            <Label htmlFor={ids.stock}>Stock</Label>
            <Input
              ref={refs.stock}
              id={ids.stock}
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={values.stock}
              onChange={(e) => set('stock', e.target.value)}
              aria-invalid={errors.stock ? true : undefined}
              aria-describedby={describe(ids.stockHint, errors.stock && ids.stockError)}
            />
          </div>
        </div>
        {errors.price && <FieldError id={ids.priceError}>{errors.price}</FieldError>}
        {errors.stock && <FieldError id={ids.stockError}>{errors.stock}</FieldError>}
        <p id={ids.stockHint} className={hintClass}>
          O stock desce a cada pedido e volta a subir se o pedido for cancelado. Em 0, o produto
          aparece como esgotado.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-ink bg-surface px-3.5 py-3">
        <span className="flex flex-col">
          <strong id={ids.publish} className="font-body text-body font-bold">
            Publicar na loja
          </strong>
          <span id={ids.publishHint} className="font-body text-small font-medium text-ink-muted">
            Desliga para guardar como oculto.
          </span>
        </span>
        <Switch
          checked={values.publish}
          onCheckedChange={(checked) => set('publish', checked)}
          aria-labelledby={ids.publish}
          aria-describedby={ids.publishHint}
        />
      </div>

      <div className="flex flex-col gap-3.5">
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={saving}
          aria-disabled={busy || undefined}
        >
          {submitLabel}
        </Button>
        {isNew ? (
          <Button
            variant="link"
            className="self-center"
            disabled={busy}
            onClick={() => void cancelNew()}
          >
            Cancelar
          </Button>
        ) : (
          <DeleteProductDialog
            productId={product.id}
            name={product.name}
            imagePaths={photos.savedImages.map((i) => i.path)}
            onDeleted={() => {
              toast.success('Produto apagado.', { duration: TOAST_MS });
              navigate(LIST);
            }}
          />
        )}
      </div>

      {notice && (
        <div role="alert">
          <Notice tone="danger">{notice}</Notice>
        </div>
      )}
    </form>
  );
}
