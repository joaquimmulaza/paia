// Estado e período de um destaque, tal como aparecem na tabela de A07.
import { formatDateTime } from '@/lib/format';
import type { AdminFeature, FeatureSource } from './types';

export type FeatureStatus = 'live' | 'scheduled' | 'expired' | 'off' | 'store';

export const STATUS_LABEL: Record<FeatureStatus, string> = {
  live: 'No ar',
  scheduled: 'Agendado',
  expired: 'Expirado',
  off: 'Desligado',
  // Ativo e dentro do período, mas a loja deixou de estar aprovada (por exemplo, suspensa).
  store: 'Loja não aprovada',
};

const before = (iso: string, now: Date) => new Date(iso).getTime() <= now.getTime();

/**
 * Calculado agora, a partir de isActive, do período [início, fim) e do estado da loja: é a
 * mesma regra da base (private.feature_is_shown). Não se confia em `isLive`, que é de quando
 * a lista foi lida: um início ou um fim que passe com a página aberta muda logo o estado.
 */
export function featureStatus(f: AdminFeature, now: Date): FeatureStatus {
  if (!f.isActive) return 'off';
  if (f.startsAt && !before(f.startsAt, now)) return 'scheduled';
  if (f.endsAt && before(f.endsAt, now)) return 'expired';
  if (f.storeStatus !== 'approved') return 'store';
  return 'live';
}

export function periodLabel(f: AdminFeature, now: Date): string {
  if (f.endsAt && before(f.endsAt, now)) return `Terminou em ${formatDateTime(f.endsAt)}`;
  if (f.startsAt && f.endsAt) {
    return `De ${formatDateTime(f.startsAt)} até ${formatDateTime(f.endsAt)}`;
  }
  if (f.startsAt) return `De ${formatDateTime(f.startsAt)}`;
  if (f.endsAt) return `Até ${formatDateTime(f.endsAt)}`;
  return 'Sem datas';
}

/** Coluna «Origem». O selo «Promovida» de C01 é outra coisa, distinta de «Loja aprovada». */
export const SOURCE_LABEL: Record<FeatureSource, string> = {
  admin: 'Administração',
  paid: 'Promoção paga',
};
