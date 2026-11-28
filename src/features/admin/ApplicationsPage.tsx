// Ecrã A01 · Candidaturas de lojas (administração, modo denso), com os estados do A01b.
// Separadores «Por analisar · N», «Recusadas» e «Aprovadas»; a lista à esquerda e o detalhe
// da candidatura escolhida à direita. Depois de decidir, passa à candidatura seguinte.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AuthErrorAlert, errorMessage } from '@/features/auth/AuthErrorAlert';
import { useAuth } from '@/features/auth/AuthProvider';
import { AFFILIATION_LABEL } from '@/features/auth/labels';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn, focusRing } from '@/lib/utils';
import { AdminShell, usePendingCount } from './AdminShell';
import { ApplicationDetail } from './ApplicationDetail';
import { listApplications } from './applications-api';
import { adminKeys, invalidateApplications } from './queries';
import type { ApplicationStatus, ApplicationSummary } from './types';

const TABS: { status: ApplicationStatus; label: string }[] = [
  { status: 'pending_approval', label: 'Por analisar' },
  { status: 'rejected', label: 'Recusadas' },
  { status: 'approved', label: 'Aprovadas' },
];

const LIST_LABEL: Record<ApplicationStatus, string> = {
  pending_approval: 'Lista de candidaturas',
  rejected: 'Candidaturas recusadas',
  approved: 'Candidaturas aprovadas',
};

const EMPTY_TITLE: Record<ApplicationStatus, string> = {
  pending_approval: 'Não há candidaturas por analisar.',
  rejected: 'Não há candidaturas recusadas.',
  approved: 'Não há candidaturas aprovadas.',
};

// s-chip do modo denso: contorno de 1 px, como no A01; 44 px de alvo.
const chipClass = cn(
  'inline-flex min-h-11 flex-none items-center rounded-md border border-ink bg-surface px-3.5',
  'font-display text-label font-bold tracking-[0.04em] whitespace-nowrap text-ink uppercase',
  'cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent]',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
  'aria-pressed:bg-ink aria-pressed:text-on-ink not-aria-pressed:hover:bg-brand-tint',
  focusRing,
);

const thClass =
  'border-b border-ink bg-paper px-3.5 py-2.5 text-left font-display text-tag font-bold whitespace-nowrap text-ink-muted uppercase';
const tdClass = 'border-b border-line-muted px-3.5 py-2.5 align-middle';
const smallClass = 'font-body text-small font-medium text-ink-muted';

export function ApplicationsPage() {
  useDocumentTitle('Candidaturas · Administração');
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id ?? null;
  const [status, setStatus] = useState<ApplicationStatus>('pending_approval');
  const listKey = adminKeys.applications(userId, status);
  const list = useQuery({ queryKey: listKey, queryFn: () => listApplications(status) });
  const pending = usePendingCount();

  // A candidatura escolhida. Fica fixa mesmo que saia da lista (por exemplo, quando outra
  // pessoa da equipa a decidiu): o detalhe continua a mostrá-la com o estado atual.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const firstId = list.data?.[0]?.id ?? null;
  useEffect(() => {
    if (selectedId === null && firstId !== null) setSelectedId(firstId);
  }, [selectedId, firstId]);
  const activeId = selectedId ?? firstId;

  // Para onde vai o foco depois de decidir: o título da seguinte ou o estado vazio.
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const emptyRef = useRef<HTMLParagraphElement>(null);
  const clearFocusTarget = useCallback(() => setFocusTarget(null), []);

  const showEmpty = list.isSuccess && list.data.length === 0 && activeId === null;
  useEffect(() => {
    if (focusTarget === 'empty' && showEmpty) {
      emptyRef.current?.focus();
      setFocusTarget(null);
    }
  }, [focusTarget, showEmpty]);

  function chooseTab(next: ApplicationStatus) {
    if (next === status) return;
    setStatus(next);
    setSelectedId(null);
  }

  const handleDecided = useCallback(
    async (decidedId: string) => {
      const before = (queryClient.getQueryData<ApplicationSummary[]>(listKey) ?? []).map(
        (a) => a.id,
      );
      const index = before.indexOf(decidedId);
      await invalidateApplications(queryClient);
      const after = (queryClient.getQueryData<ApplicationSummary[]>(listKey) ?? []).filter(
        (a) => a.id !== decidedId,
      );
      // A seguinte na ordem que estava no ecrã; se era a última, a primeira que sobra.
      const next =
        after.find((a) => {
          const was = before.indexOf(a.id);
          return was === -1 || was > index;
        }) ??
        after[0] ??
        null;
      setSelectedId(next?.id ?? null);
      setFocusTarget(next?.id ?? 'empty');
    },
    [queryClient, listKey],
  );

  const pendingLabel = pending.isSuccess ? `Por analisar · ${pending.data}` : 'Por analisar';

  return (
    <AdminShell active="candidaturas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 font-display text-title font-bold">Candidaturas de lojas</h1>
        <div role="group" aria-label="Filtrar" className="flex flex-wrap items-center gap-2.5">
          {TABS.map((tab) => (
            <button
              key={tab.status}
              type="button"
              aria-pressed={tab.status === status}
              className={chipClass}
              onClick={() => chooseTab(tab.status)}
            >
              {tab.status === 'pending_approval' ? pendingLabel : tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4.5">
        <section
          aria-label={LIST_LABEL[status]}
          className="min-w-0 flex-[1_1_380px] overflow-hidden rounded-md border border-ink bg-surface"
        >
          {list.isPending && (
            <div role="status" className="flex flex-col gap-2 p-4">
              <span className="sr-only">A carregar as candidaturas…</span>
              {[0, 1].map((i) => (
                <span key={i} aria-hidden="true" className="h-11 rounded-sm bg-brand-tint" />
              ))}
            </div>
          )}
          {list.isError && (
            <div className="flex flex-col items-start gap-3 p-4">
              <AuthErrorAlert message={errorMessage(list.error)} />
              <Button
                variant="secondary"
                size="sm"
                loading={list.isFetching}
                onClick={() => void list.refetch()}
              >
                Tentar outra vez
              </Button>
            </div>
          )}
          {list.isSuccess && list.data.length === 0 && (
            <div className="p-4">
              <div className="flex flex-col items-center gap-3 rounded-lg border border-ink bg-surface px-4 py-7 text-center">
                <CircleCheck aria-hidden="true" className="size-8 text-ink" />
                <p
                  ref={emptyRef}
                  tabIndex={-1}
                  className="m-0 font-display text-base leading-[22px] font-bold outline-none"
                >
                  {EMPTY_TITLE[status]}
                </p>
                {status === 'pending_approval' && (
                  <p className="m-0 max-w-[300px] font-body text-caption font-medium text-ink">
                    Os pedidos novos aparecem aqui, do mais antigo para o mais recente.
                  </p>
                )}
              </div>
            </div>
          )}
          {list.isSuccess && list.data.length > 0 && (
            // `relative`: os textos sr-only ficam dentro da caixa e não alargam a página.
            <div className="relative overflow-x-auto">
              <table className="w-full border-collapse font-body text-sm leading-5">
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>
                      Loja
                    </th>
                    <th scope="col" className={thClass}>
                      Pedida por
                    </th>
                    <th scope="col" className={thClass}>
                      {status === 'pending_approval' ? 'Enviada' : 'Decisão'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((a) => (
                    <ApplicationRow
                      key={a.id}
                      application={a}
                      status={status}
                      selected={a.id === activeId}
                      onSelect={() => setSelectedId(a.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {activeId !== null && (
          <ApplicationDetail
            key={activeId}
            storeId={activeId}
            onDecided={(id) => void handleDecided(id)}
            focusTitle={focusTarget === activeId}
            onTitleFocused={clearFocusTarget}
          />
        )}
      </div>
    </AdminShell>
  );
}

type RowProps = {
  application: ApplicationSummary;
  status: ApplicationStatus;
  selected: boolean;
  onSelect: () => void;
};

function ApplicationRow({ application: a, status, selected, onSelect }: RowProps) {
  const at = status === 'pending_approval' ? a.submittedAt : a.decidedAt;
  return (
    <tr
      className={cn('[&:last-child>td]:border-b-0', selected && '[&>td]:bg-brand-tint')}
      data-selected={selected || undefined}
    >
      <td className={cn(tdClass, 'min-w-40')}>
        <button
          type="button"
          aria-current={selected ? 'true' : undefined}
          onClick={onSelect}
          className={cn(
            'inline-flex min-h-11 cursor-pointer items-center rounded-sm text-left font-bold text-ink underline underline-offset-3',
            focusRing,
          )}
        >
          {a.name}
        </button>
        {a.categoryName && <span className={cn(smallClass, 'block')}>{a.categoryName}</span>}
      </td>
      <td className={cn(tdClass, 'min-w-32')}>
        {a.ownerName}
        <span className={cn(smallClass, 'block')}>{AFFILIATION_LABEL[a.ownerAffiliation]}</span>
      </td>
      <td className={cn(tdClass, 'whitespace-nowrap')}>{at ? formatDateTime(at) : '—'}</td>
    </tr>
  );
}
