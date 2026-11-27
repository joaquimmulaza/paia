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
 * «No ar» vem da base (`isLive`), que conhece o estado da loja. Os outros estados
 * explicam porque não está no ar. O período é [início, fim): o fim exato já não conta.
 */
export function featureStatus(f: AdminFeature, now: Date): FeatureStatus {
  if (f.isLive) return 'live';
  if (!f.isActive) return 'off';
  if (f.startsAt && !before(f.startsAt, now)) return 'scheduled';
  if (f.endsAt && before(f.endsAt, now)) return 'expired';
  return 'store';
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
