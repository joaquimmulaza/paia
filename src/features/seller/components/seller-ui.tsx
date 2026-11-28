// Peças comuns aos ecrãs da candidatura (V01–V03b): Voltar com nome próprio, cartão s-card,
// aviso s-notice, marca s-mark, o redirecionamento por estado e o carregamento.
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, CircleAlert, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getMyProfile } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { iconButtonClass } from '@/features/catalog/components/icon-button';
import { publicImageUrl } from '@/features/catalog/labels';
import { storeInitials } from '@/features/catalog/components/store-text';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MyStoreKind } from '../types';

/** O mesmo pedido (e a mesma chave) que o Perfil: a cache serve os dois ecrãs. */
export function useMyProfile() {
  const userId = useAuth().session?.user.id ?? null;
  return useQuery({
    queryKey: ['me', 'profile', userId],
    queryFn: getMyProfile,
    enabled: userId !== null,
  });
}

/** Para onde vai quem abre um ecrã da candidatura que não serve ao estado da sua loja. */
export const HOME_BY_KIND: Record<MyStoreKind, string> = {
  none: '/vender',
  draft: '/vender/pedido',
  pending: '/vender/estado',
  rejected: '/vender/estado',
  suspended: '/vender/estado',
  approved: '/vender/loja',
};

/** s-iconbtn com o nome do destino («Voltar ao perfil»). */
export function BackLink({ to, label = 'Voltar' }: { to: string; label?: string }) {
  return (
    <Link to={to} aria-label={label} className={iconButtonClass('surface')}>
      <ChevronLeft aria-hidden="true" className="size-6" />
    </Link>
  );
}

/** s-card: contorno ink, raio lg, fundo surface. */
export const cardClass =
  'flex flex-col gap-3 rounded-lg border-2 border-ink bg-surface p-4 text-ink';

/** p-kicker: rótulo de secção (Space Grotesk, maiúsculas). */
export const kickerClass = 'm-0 font-display text-label font-bold text-ink uppercase';

/** s-h2. */
export const h2Class = 'm-0 font-display text-title font-bold text-ink';

/** s-notice: informação (info-tint) ou erro (danger-tint), sempre com ícone e texto. */
export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'danger';
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === 'danger' ? CircleAlert : Info;
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-md border-2 border-ink px-3.5 py-3 font-body text-sm leading-5 text-ink',
        tone === 'danger' ? 'bg-danger-tint' : 'bg-info-tint',
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('mt-px size-5 shrink-0', tone === 'danger' && 'text-danger')}
      />
      <p className="m-0">{children}</p>
    </div>
  );
}

/** s-mark: o logótipo, ou as iniciais em fundo brand quando ainda não há logótipo. */
export function StoreMark({
  name,
  logoPath,
  size = 'md',
}: {
  name: string;
  logoPath: string | null;
  size?: 'md' | 'lg';
}) {
  const box = size === 'lg' ? 'size-18 rounded-lg text-[28px]' : 'size-11 rounded-md text-[17px]';
  if (logoPath) {
    return (
      <img
        src={publicImageUrl('store-media', logoPath)}
        alt=""
        className={cn('block flex-none border-2 border-ink object-cover', box)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex flex-none items-center justify-center border-2 border-ink bg-brand font-display leading-none font-bold text-ink',
        box,
      )}
    >
      {storeInitials(name)}
    </span>
  );
}

/** Enquanto a loja carrega: blocos estáticos (s-skel), sem animação. */
export function SellerSkeleton({ label = 'A carregar a tua loja…' }: { label?: string }) {
  return (
    <div role="status" className={cn(cardClass, 'gap-3')}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="h-5 w-1/2 rounded-sm bg-brand-tint" />
      <span aria-hidden="true" className="h-6.5 w-3/4 rounded-sm bg-brand-tint" />
      <span aria-hidden="true" className="h-11 w-32 rounded-md bg-brand-tint" />
    </div>
  );
}

/** p-reason: a resposta da administração, com o texto da equipa sem formatação. */
export function TeamMessage({ message }: { message: string }) {
  return (
    <p className="m-0 rounded-md border-2 border-ink bg-danger-tint px-3.5 py-3 font-body text-body break-words whitespace-pre-line">
      <strong>Mensagem da equipa:</strong> {message}
    </p>
  );
}

/** s-history: um ponto ink, a data em Africa/Luanda e o acontecimento. */
export function HistoryItem({ at, children }: { at: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[12px_minmax(0,1fr)] gap-2.5 font-body text-sm leading-5">
      <span aria-hidden="true" className="mt-1.25 size-2.5 rounded-full bg-ink" />
      <span>
        {formatDateTime(at)} · {children}
      </span>
    </li>
  );
}
