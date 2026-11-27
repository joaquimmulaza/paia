// Ecrã A07 · Destaques (administração, modo denso).
// Lista os destaques da administração pela ordem do Início, liga e desliga cada um,
// muda a ordem com «Subir»/«Descer», adiciona e remove (com confirmação).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { forwardRef, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AuthErrorAlert, errorMessage } from '@/features/auth/AuthErrorAlert';
import { tagClass } from '@/features/catalog/components/tag-styles';
import { currentUserId, useAuth } from '@/features/auth/AuthProvider';
import { cn, focusRing } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/use-document-title';
import { AddFeatureForm } from './AddFeatureForm';
import { AdminShell } from './AdminShell';
import { listFeatures, removeFeature, reorderFeatures, setFeatureActive } from './api';
import { adminKeys, invalidateFeatures } from './queries';

import {
  featureStatus,
  periodLabel,
  SOURCE_LABEL,
  STATUS_LABEL,
  type FeatureStatus,
} from './status';
import type { AdminFeature } from './types';

const STATUS_TAG: Record<FeatureStatus, string> = {
  live: tagClass.done,
  scheduled: tagClass.accepted,
  expired: tagClass.neutral,
  off: tagClass.waiting,
  store: tagClass.waiting,
};

type Direction = 'up' | 'down';

/** Os ativos pela ordem da base (é a ordem do Início); os desligados no fim, sem ordem. */
function splitByActive(features: AdminFeature[]) {
  return {
    active: features.filter((f) => f.isActive),
    inactive: features.filter((f) => !f.isActive),
  };
}

export function FeaturesPage() {
  useDocumentTitle('Destaques · Administração');
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id ?? null;
  const featuresKey = adminKeys.features(userId);
  const features = useQuery({ queryKey: featuresKey, queryFn: listFeatures });
  const [formOpen, setFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);

  // O foco segue o controlo usado quando a linha muda de sítio:
  // - ao mover, fica na mesma seta do item movido enquanto a ordenação corre;
  // - ao ligar ou desligar, a linha passa para o fim ou volta à ordem, e o foco vai uma vez
  //   para o interruptor dela, depois de a lista ser lida outra vez.
  const controls = useRef(new Map<string, HTMLButtonElement>());
  const [focusAfterMove, setFocusAfterMove] = useState<string | null>(null);
  const focusOnce = useRef<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  useLayoutEffect(() => {
    if (focusOnce.current) {
      controls.current.get(focusOnce.current)?.focus();
      focusOnce.current = null;
      return;
    }
    if (focusAfterMove) controls.current.get(focusAfterMove)?.focus();
  }, [focusTick, focusAfterMove, features.data]);
  const requestFocus = useCallback((key: string) => {
    focusOnce.current = key;
    setFocusTick((t) => t + 1);
  }, []);
  const controlRef = useCallback(
    (key: string) => (el: HTMLButtonElement | null) => {
      if (el) controls.current.set(key, el);
      else controls.current.delete(key);
    },
    [],
  );

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderFeatures(ids),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: featuresKey });
      queryClient.setQueryData<AdminFeature[]>(featuresKey, (old) => {
        if (!old) return old;
        const byId = new Map(old.map((f) => [f.id, f]));
        const moved = ids.map((id) => byId.get(id)).filter((f): f is AdminFeature => !!f);
        return [...moved, ...old.filter((f) => !ids.includes(f.id))];
      });
    },
    onError: (error) => setActionError(errorMessage(error)),
    // Com sucesso ou não, lê outra vez: uma lista desatualizada volta ao estado real.
    // Depois disso o foco já não é puxado para a seta (o utilizador pode ter ido para outro lado).
    onSettled: async () => {
      await invalidateFeatures(queryClient);
      setFocusAfterMove(null);
    },
  });

  function move(feature: AdminFeature, direction: Direction, active: AdminFeature[]) {
    const from = active.findIndex((f) => f.id === feature.id);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= active.length || reorder.isPending) return;
    const ids = active.map((f) => f.id);
    [ids[from], ids[to]] = [ids[to] as string, ids[from] as string];
    setActionError(null);
    setFocusAfterMove(`${feature.id}:${direction}`);
    reorder.mutate(ids);
  }

  function openForm() {
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    addButton.current?.focus();
  }

  const now = new Date();
  const { active, inactive } = splitByActive(features.data ?? []);
  const nextPosition = active.reduce((max, f) => Math.max(max, f.position + 1), 0);

  return (
    <AdminShell active="destaques">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 font-display text-title font-bold">Destaques</h1>
        <Button
          ref={addButton}
          variant="primary"
          size="sm"
          aria-expanded={formOpen}
          aria-controls={formOpen ? 'adicionar-destaque' : undefined}
          onClick={openForm}
        >
          Adicionar destaque
        </Button>
      </div>
      <p className="m-0 max-w-[720px] font-body text-caption font-medium text-ink">
        Escolhe as lojas que aparecem em «Lojas da comunidade», na página inicial. A ordem desta
        lista é a ordem no Início. Só lojas aprovadas podem estar em destaque.
      </p>

      <AuthErrorAlert message={actionError} />

      <div className="flex flex-wrap items-start gap-4.5">
        <section
          aria-label="Lista de destaques"
          className="min-w-0 flex-[2_1_640px] overflow-hidden rounded-md border border-ink bg-surface"
        >
          {features.isPending && <ListSkeleton />}
          {features.isError && (
            <div className="flex flex-col items-start gap-3 p-4">
              <AuthErrorAlert message={errorMessage(features.error)} />
              <Button
                variant="secondary"
                size="sm"
                loading={features.isFetching}
                onClick={() => void features.refetch()}
              >
                Tentar outra vez
              </Button>
            </div>
          )}
          {features.isSuccess && features.data.length === 0 && (
            <p className="m-0 p-4 font-body text-body">
              Ainda não há lojas em destaque. Adiciona a primeira.
            </p>
          )}
          {features.isSuccess && features.data.length > 0 && (
            <>
              {/* a-scroll. `relative`: os textos sr-only (absolutos) ficam dentro da caixa e não alargam a página. */}
              <div className="relative overflow-x-auto">
                <table className="w-full border-collapse font-body text-sm leading-5">
                  <thead>
                    <tr>
                      {['Ordem', 'Loja', 'Período', 'Estado', 'Origem', 'Ativo'].map((h) => (
                        <th key={h} scope="col" className={thClass}>
                          {h}
                        </th>
                      ))}
                      <th scope="col" className={thClass}>
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  {/* Uma só lista: ao ligar ou desligar, a linha muda de sítio sem ser montada de novo. */}
                  <tbody>
                    {[...active, ...inactive].map((f) => {
                      const i = active.indexOf(f);
                      return (
                        <FeatureRow
                          key={f.id}
                          feature={f}
                          now={now}
                          order={i >= 0 ? i + 1 : null}
                          canUp={i > 0}
                          canDown={i >= 0 && i < active.length - 1}
                          onMove={(dir) => move(f, dir, active)}
                          controlRef={controlRef}
                          onToggled={() => requestFocus(`${f.id}:switch`)}
                          onError={setActionError}
                          onRemoved={() => addButton.current?.focus()}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="m-0 border-t border-ink px-3.5 py-2.5 font-body text-small font-medium text-ink-muted">
                No ar: pode aparecer no Início (até 10 lojas).
              </p>
            </>
          )}
        </section>

        {formOpen && (
          <AddFeatureForm id="adicionar-destaque" nextPosition={nextPosition} onClose={closeForm} />
        )}
      </div>
    </AdminShell>
  );
}

const thClass =
  'border-b border-ink bg-paper px-3.5 py-2.5 text-left font-display text-tag font-bold whitespace-nowrap text-ink-muted uppercase';
const tdClass = 'border-b border-line-muted px-3.5 py-2.5 align-middle';

type FeatureRowProps = {
  feature: AdminFeature;
  now: Date;
  /** Posição mostrada (1, 2, …); null para um destaque desligado, que não entra na ordem. */
  order: number | null;
  canUp: boolean;
  canDown: boolean;
  onMove: (direction: Direction) => void;
  controlRef: (key: string) => (el: HTMLButtonElement | null) => void;
  /** Depois de ligar ou desligar e de a lista ser lida outra vez. */
  onToggled: () => void;
  onError: (message: string | null) => void;
  onRemoved: () => void;
};

function FeatureRow({
  feature: f,
  now,
  order,
  canUp,
  canDown,
  onMove,
  controlRef,
  onToggled,
  onError,
  onRemoved,
}: FeatureRowProps) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: (active: boolean) => setFeatureActive(f.id, active),
    onMutate: () => onError(null),
    onError: (error) => onError(errorMessage(error)),
    onSettled: async () => {
      await invalidateFeatures(queryClient);
      onToggled();
    },
  });
  const status = featureStatus(f, now);
  const checked = toggle.isPending ? toggle.variables : f.isActive;

  return (
    <tr className="[&:last-child>td]:border-b-0">
      <td className={tdClass}>
        <div className="flex items-center gap-1">
          <strong className="min-w-5">
            {order ?? (
              <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">Sem ordem</span>
              </>
            )}
          </strong>
          {/* Um destaque desligado não entra na ordem (a base recusa-o): sem setas. */}
          {order !== null && (
            <>
              <ArrowButton
                ref={controlRef(`${f.id}:up`)}
                label={`Subir ${f.storeName}`}
                disabled={!canUp}
                onClick={() => onMove('up')}
              >
                <ChevronUp aria-hidden="true" className="size-5" />
              </ArrowButton>
              <ArrowButton
                ref={controlRef(`${f.id}:down`)}
                label={`Descer ${f.storeName}`}
                disabled={!canDown}
                onClick={() => onMove('down')}
              >
                <ChevronDown aria-hidden="true" className="size-5" />
              </ArrowButton>
            </>
          )}
        </div>
      </td>
      <td className={cn(tdClass, 'min-w-40')}>
        <Link
          to={`/loja/${f.storeSlug}`}
          className={cn('rounded-sm font-bold text-ink underline underline-offset-3', focusRing)}
        >
          {f.storeName}
        </Link>
      </td>
      <td className={cn(tdClass, 'min-w-36')}>{periodLabel(f, now)}</td>
      <td className={tdClass}>
        <span className={STATUS_TAG[status]}>{STATUS_LABEL[status]}</span>
      </td>
      <td className={tdClass}>{SOURCE_LABEL[f.source]}</td>
      <td className={tdClass}>
        <Switch
          ref={controlRef(`${f.id}:switch`)}
          aria-label={`Destaque de ${f.storeName} ativo`}
          checked={checked}
          aria-busy={toggle.isPending || undefined}
          onCheckedChange={(next) => {
            if (!toggle.isPending) toggle.mutate(next);
          }}
        />
      </td>
      <td className={tdClass}>
        <RemoveFeature feature={f} onRemoved={onRemoved} />
      </td>
    </tr>
  );
}

type ArrowButtonProps = {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

/**
 * s-iconbtn de 44 px. Nas pontas fica `aria-disabled` (e não `disabled`): continua
 * focável, para o foco poder ficar no botão de um item que acabou de chegar à ponta.
 */
// forwardRef: em React 18 o `ref` não chega a um componente de função sem ele.
const ArrowButton = forwardRef<HTMLButtonElement, ArrowButtonProps>(function ArrowButton(
  { label, disabled, onClick, children },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-surface text-ink',
        'cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] hover:bg-brand-tint',
        'aria-disabled:cursor-not-allowed aria-disabled:border-dashed aria-disabled:border-line-muted aria-disabled:text-line-muted aria-disabled:hover:bg-surface',
        focusRing,
      )}
    >
      {children}
    </button>
  );
});

function RemoveFeature({
  feature: f,
  onRemoved,
}: {
  feature: AdminFeature;
  onRemoved: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const removed = useRef(false);

  const remove = useMutation({
    mutationFn: () => removeFeature(f.id),
    onMutate: () => ({ userId: currentUserId() }),
    onSuccess: (_data, _vars, context) => {
      removed.current = true;
      // Se a conta mudou a meio, a confirmação não é para quem está agora no aparelho.
      if (context.userId === currentUserId()) toast('Destaque removido.');
      setOpen(false);
    },
    onSettled: () => invalidateFeatures(queryClient),
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (remove.isPending) return;
        if (next) remove.reset();
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="link"
          size="sm"
          className="text-danger active:text-danger"
          aria-label={`Remover ${f.storeName}`}
        >
          Remover
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          // A linha desaparece: o foco vai para «Adicionar destaque», não para o vazio.
          if (removed.current) {
            event.preventDefault();
            onRemoved();
          }
        }}
      >
        <AlertDialogTitle>Remover destaque de {f.storeName}?</AlertDialogTitle>
        <AlertDialogBody>
          <AlertDialogDescription>
            A loja deixa de aparecer em «Lojas da comunidade». A loja e os produtos não mudam. Podes
            voltar a pô-la em destaque quando quiseres.
          </AlertDialogDescription>
          <AuthErrorAlert message={remove.isError ? errorMessage(remove.error) : null} />
          <AlertDialogFooter>
            <Button
              variant="danger"
              size="sm"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? 'A remover…' : 'Remover destaque'}
            </Button>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogBody>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Linhas estáticas (s-skel), sem animação. */
function ListSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-2 p-4">
      <span className="sr-only">A carregar os destaques…</span>
      {[0, 1, 2].map((i) => (
        <span key={i} aria-hidden="true" className="h-11 rounded-sm bg-brand-tint" />
      ))}
    </div>
  );
}
