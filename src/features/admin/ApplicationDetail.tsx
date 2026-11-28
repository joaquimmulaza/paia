// A01 e A01b · o detalhe de uma candidatura (a-box à direita da lista).
// Pendente: dados da loja e do dono, lista de verificação, mensagem e «Aprovar loja»/«Recusar».
// Decidida: a mensagem enviada, a lista de verificação e o histórico.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AuthErrorAlert, errorMessage } from '@/features/auth/AuthErrorAlert';
import { currentUserId, useAuth } from '@/features/auth/AuthProvider';
import { AFFILIATION_LABEL } from '@/features/auth/labels';
import { tagClass } from '@/features/catalog/components/tag-styles';
import { describe, FieldError } from '@/features/seller/components/form-ui';
import { HistoryItem, StoreMark } from '@/features/seller/components/seller-ui';
import { MESSAGES } from '@/lib/errors';
import { cn, focusRing } from '@/lib/utils';
import { accountAgeLabel } from './account-age';
import { firstName, shortPersonName } from './person-name';
import { decideStore, getApplication, listStoreDecisions } from './applications-api';
import { adminKeys, invalidateApplications } from './queries';
import type {
  ApplicationDetail as Application,
  Checklist,
  DecisionKind,
  StoreDecisionEntry,
  StoreStatus,
} from './types';

const CHECKLIST_KEYS = ['name_description', 'allowed', 'images', 'account'] as const;

/** Os textos das 4 caixas, como no A01. */
export const CHECKLIST_LABEL: Record<keyof Checklist, string> = {
  name_description: 'Nome e descrição dizem claramente o que a loja vende.',
  allowed: 'A categoria e os produtos são permitidos na comunidade.',
  images: 'Imagens adequadas e sem dados pessoais visíveis.',
  account: 'Conta de estudante com email confirmado.',
};

const EMPTY_CHECKLIST: Checklist = {
  name_description: false,
  allowed: false,
  images: false,
  account: false,
};

const STATUS_TAG: Record<StoreStatus, { label: string; className: string }> = {
  pending_approval: { label: 'Em análise', className: tagClass.waiting },
  approved: { label: 'Aprovada', className: tagClass.done },
  rejected: { label: 'Recusada', className: tagClass.cancelled },
  suspended: { label: 'Suspensa', className: tagClass.neutral },
  draft: { label: 'Rascunho', className: tagClass.neutral },
};

const DECISION_LABEL: Record<DecisionKind, string> = {
  approved: 'Aprovada',
  rejected: 'Recusada',
  suspended: 'Suspensa',
  reactivated: 'Reativada',
};

const MESSAGE_MAX = 500;

const boxClass = 'min-w-0 overflow-hidden rounded-md border border-ink bg-surface';
const headClass = 'flex items-center justify-between gap-2.5 border-b border-ink px-4 py-3';
const bodyClass = 'flex flex-col gap-3 p-4';
const dlClass =
  'm-0 grid grid-cols-[minmax(96px,140px)_minmax(0,1fr)] gap-x-3.5 gap-y-1.5 font-body text-sm leading-5';
const dtClass = 'font-medium text-ink-muted';
const ddClass = 'm-0 break-words whitespace-pre-line';
const kickerClass = 'm-0 font-display text-label font-bold text-ink-muted uppercase';
const smallClass = 'm-0 font-body text-small font-medium text-ink-muted';

type Props = {
  storeId: string;
  /** Depois de uma decisão com sucesso: a página passa à candidatura seguinte. */
  onDecided: (storeId: string) => void;
  /** Põe o foco no título quando o detalhe estiver pronto (ao chegar à candidatura seguinte). */
  focusTitle: boolean;
  onTitleFocused: () => void;
};

export function ApplicationDetail({ storeId, onDecided, focusTitle, onTitleFocused }: Props) {
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id ?? null;
  const application = useQuery({
    queryKey: adminKeys.application(userId, storeId),
    queryFn: () => getApplication(storeId),
  });
  const decisions = useQuery({
    queryKey: adminKeys.decisions(userId, storeId),
    queryFn: () => listStoreDecisions(storeId),
  });
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Outra pessoa da equipa decidiu: o aviso fica até se escolher outra candidatura.
  const [alreadyDecided, setAlreadyDecided] = useState(false);

  const ready = application.isSuccess && application.data !== null;
  useEffect(() => {
    if (focusTitle && ready) {
      headingRef.current?.focus();
      onTitleFocused();
    }
  }, [focusTitle, ready, onTitleFocused]);

  if (application.isPending) {
    return (
      <section aria-label="A carregar a candidatura" className={cn(boxClass, 'flex-[2_1_520px]')}>
        <div role="status" className="flex flex-col gap-2 p-4">
          <span className="sr-only">A carregar a candidatura…</span>
          {[0, 1, 2].map((i) => (
            <span key={i} aria-hidden="true" className="h-11 rounded-sm bg-brand-tint" />
          ))}
        </div>
      </section>
    );
  }
  if (application.isError || application.data === null) {
    return (
      <section aria-label="Candidatura" className={cn(boxClass, 'flex-[2_1_520px]')}>
        <div className="flex flex-col items-start gap-3 p-4">
          <AuthErrorAlert
            message={application.isError ? errorMessage(application.error) : MESSAGES.notFound}
          />
          {application.isError && (
            <Button
              variant="secondary"
              size="sm"
              loading={application.isFetching}
              onClick={() => void application.refetch()}
            >
              Tentar outra vez
            </Button>
          )}
        </div>
      </section>
    );
  }

  const app = application.data;
  const tag = STATUS_TAG[app.status];
  const history = decisions.data ?? [];

  return (
    <section aria-labelledby={titleId} className={cn(boxClass, 'flex-[2_1_520px]')}>
      <div className={headClass}>
        <h2
          ref={headingRef}
          id={titleId}
          tabIndex={-1}
          className="m-0 min-w-0 font-display text-lg leading-[22px] font-bold break-words outline-none"
        >
          {app.name}
        </h2>
        <span className={tag.className}>{tag.label}</span>
      </div>
      <div className={bodyClass}>
        <AuthErrorAlert message={alreadyDecided ? MESSAGES.alreadyDecided : null} tone="warning" />
        {app.status === 'pending_approval' ? (
          <>
            <div className="flex flex-wrap items-start gap-4">
              <StoreMark name={app.name} logoPath={app.logoPath} size="lg" />
              <dl className={cn(dlClass, 'min-w-60 flex-1')}>
                <dt className={dtClass}>Descrição</dt>
                <dd className={ddClass}>{app.description}</dd>
                <dt className={dtClass}>Categoria</dt>
                <dd className={ddClass}>{app.categoryName ?? '—'}</dd>
                <dt className={dtClass}>Endereço</dt>
                <dd className={ddClass}>…/loja/{app.slug}</dd>
                <dt className={dtClass}>Proprietária</dt>
                <dd className={ddClass}>
                  {shortPersonName(app.ownerName)} · {AFFILIATION_LABEL[app.ownerAffiliation]} ·{' '}
                  {accountAgeLabel(app.ownerCreatedAt)}
                </dd>
              </dl>
            </div>
            {/* Não é montado de novo quando a loja foi reenviada (ALREADY_DECIDED): a mensagem
                escrita e as caixas ficam, e a decisão seguinte usa o submitted_at novo. */}
            <DecisionForm
              application={app}
              onAlreadyDecided={async () => {
                setAlreadyDecided(true);
                await invalidateApplications(queryClient);
                headingRef.current?.focus();
              }}
              onClearNotice={() => setAlreadyDecided(false)}
              onDecided={() => onDecided(storeId)}
            />
            {history.length > 0 && <History application={app} decisions={history} />}
          </>
        ) : (
          <>
            <DecidedSummary latest={history[0]} />
            <History application={app} decisions={history} />
          </>
        )}
      </div>
    </section>
  );
}

type FormProps = {
  application: Application;
  onAlreadyDecided: () => Promise<void>;
  onClearNotice: () => void;
  onDecided: () => void;
};

function DecisionForm({ application: app, onAlreadyDecided, onClearNotice, onDecided }: FormProps) {
  const ids = { message: useId(), messageError: useId() };
  const [checklist, setChecklist] = useState<Checklist>(EMPTY_CHECKLIST);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);

  const decide = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      decideStore({
        storeId: app.id,
        decision,
        message,
        checklist,
        expectedSubmittedAt: app.submittedAt,
      }),
    onMutate: () => {
      setFailure(null);
      onClearNotice();
      return { userId: currentUserId() };
    },
    onSuccess: (_status, decision, context) => {
      // Se a conta mudou a meio, o aviso não é para quem está agora no aparelho.
      if (context.userId === currentUserId()) {
        toast.success(
          decision === 'approved'
            ? `Loja aprovada. A ${firstName(app.ownerName)} já pode publicar produtos.`
            : 'Loja recusada. A mensagem foi enviada à candidata.',
        );
      }
      onDecided();
    },
    onError: async (error) => {
      const text = errorMessage(error);
      // A mensagem escrita fica: se a loja foi reenviada, continua a servir.
      if (text === MESSAGES.alreadyDecided) {
        await onAlreadyDecided();
        return;
      }
      setFailure(text);
    },
  });

  useEffect(() => {
    if (failure) failureRef.current?.focus();
  }, [failure]);

  function reject() {
    if (message.trim() === '') {
      setMessageError(true);
      messageRef.current?.focus();
      return;
    }
    decide.mutate('rejected');
  }

  const busy = decide.isPending;

  return (
    <>
      <fieldset className="m-0 flex flex-col gap-2 rounded-md border border-line-muted px-3.5 pt-1 pb-3">
        <legend className={cn(kickerClass, 'px-1.5 text-ink')}>Checklist</legend>
        {CHECKLIST_KEYS.map((key) => {
          const id = `${app.id}-${key}`;
          return (
            <div key={key} className="flex items-start gap-2.5 py-0.5">
              <Checkbox
                id={id}
                checked={checklist[key]}
                disabled={busy}
                onCheckedChange={(next) => setChecklist((c) => ({ ...c, [key]: next === true }))}
              />
              <label htmlFor={id} className="cursor-pointer font-body text-sm leading-5">
                {CHECKLIST_LABEL[key]}
              </label>
            </div>
          );
        })}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={ids.message}>Mensagem para a candidata</Label>
        <textarea
          ref={messageRef}
          id={ids.message}
          value={message}
          maxLength={MESSAGE_MAX}
          placeholder="Obrigatória se recusares. Diz o que deve corrigir."
          onChange={(e) => {
            setMessage(e.target.value);
            if (messageError) setMessageError(false);
          }}
          aria-invalid={messageError || undefined}
          aria-describedby={describe(messageError && ids.messageError)}
          className={cn(
            'min-h-20 w-full min-w-0 resize-y rounded-md border border-ink bg-surface px-3 py-2 font-body text-base text-ink',
            'placeholder:text-ink-muted placeholder:opacity-100',
            'aria-invalid:border-danger aria-invalid:bg-danger-tint',
            focusRing,
          )}
        />
        {messageError && <FieldError id={ids.messageError}>{MESSAGES.messageRequired}</FieldError>}
      </div>

      {failure && (
        <div ref={failureRef} tabIndex={-1} className={cn('rounded-md', focusRing)}>
          <AuthErrorAlert message={failure} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          variant="primary"
          size="sm"
          loading={busy && decide.variables === 'approved'}
          disabled={busy}
          onClick={() => decide.mutate('approved')}
        >
          {busy && decide.variables === 'approved' ? 'A aprovar…' : 'Aprovar loja'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          loading={busy && decide.variables === 'rejected'}
          disabled={busy}
          onClick={reject}
        >
          {busy && decide.variables === 'rejected' ? 'A recusar…' : 'Recusar'}
        </Button>
        <span className={smallClass}>A decisão fica no histórico, com o teu nome e a data.</span>
      </div>
    </>
  );
}

function confirmedCount(checklist: Checklist): number {
  return CHECKLIST_KEYS.filter((key) => checklist[key]).length;
}

/** A01b: a mensagem enviada e quantos itens da lista de verificação ficaram confirmados. */
function DecidedSummary({ latest }: { latest: StoreDecisionEntry | undefined }) {
  if (!latest) return null;
  return (
    <dl className={dlClass}>
      {latest.message && (
        <>
          <dt className={dtClass}>Mensagem enviada</dt>
          <dd className={ddClass}>{latest.message}</dd>
        </>
      )}
      <dt className={dtClass}>Checklist</dt>
      <dd className={ddClass}>{confirmedCount(latest.checklist)} de 4 itens confirmados</dd>
    </dl>
  );
}

type HistoryEntry = { at: string; key: string; label: string; message: string | null };

/** As decisões e o envio atual, do mais recente para o mais antigo. */
function History({
  application: app,
  decisions,
}: {
  application: Application;
  decisions: StoreDecisionEntry[];
}) {
  const entries: HistoryEntry[] = decisions.map((d, i) => ({
    at: d.createdAt,
    key: `d${i}`,
    label: d.adminName
      ? `${DECISION_LABEL[d.decision]} por ${shortPersonName(d.adminName)}`
      : DECISION_LABEL[d.decision],
    message: d.decision === 'rejected' ? d.message : null,
  }));
  if (app.submittedAt) {
    entries.push({
      at: app.submittedAt,
      key: 'submitted',
      label: 'Enviada para análise.',
      message: null,
    });
  }
  entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <>
      <h3 className={cn(kickerClass, 'mt-1')}>Histórico</h3>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {entries.map((e) => (
          <HistoryItem key={e.key} at={e.at}>
            {e.label}
            {e.message && (
              <span className="mt-0.5 block break-words whitespace-pre-line text-ink-muted">
                {e.message}
              </span>
            )}
          </HistoryItem>
        ))}
      </ul>
    </>
  );
}
