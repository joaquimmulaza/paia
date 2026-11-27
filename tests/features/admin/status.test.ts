import { describe, expect, it } from 'vitest';
import { featureStatus, periodLabel, SOURCE_LABEL, STATUS_LABEL } from '@/features/admin/status';
import type { AdminFeature } from '@/features/admin/types';
import { formatDateTime } from '@/lib/format';

const NOW = new Date('2026-11-27T12:00:00Z');
const PAST = '2026-11-01T10:00:00+01:00';
const FUTURE = '2026-12-20T10:00:00+01:00';

function feature(over: Partial<AdminFeature> = {}): AdminFeature {
  return {
    id: 'f1',
    storeId: 's1',
    storeName: 'Doces da Ana',
    storeSlug: 'doces-da-ana',
    storeStatus: 'approved',
    source: 'admin',
    position: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
    note: null,
    isLive: false,
    ...over,
  };
}

describe('featureStatus', () => {
  it('«No ar» quando está ativo, a loja aprovada e dentro do período', () => {
    expect(featureStatus(feature({ isLive: true }), NOW)).toBe('live');
    expect(featureStatus(feature({ startsAt: PAST, endsAt: FUTURE, isLive: true }), NOW)).toBe(
      'live',
    );
  });

  it('o início chegou depois de a lista ser lida (isLive ainda false): «No ar», não «Loja não aprovada»', () => {
    expect(featureStatus(feature({ startsAt: PAST, isLive: false }), NOW)).toBe('live');
  });

  it('o início exatamente agora já conta (período [início, fim))', () => {
    expect(featureStatus(feature({ startsAt: NOW.toISOString() }), NOW)).toBe('live');
  });

  it('o fim passou depois de a lista ser lida (isLive ainda true): «Expirado», não «No ar»', () => {
    expect(featureStatus(feature({ endsAt: PAST, isLive: true }), NOW)).toBe('expired');
  });

  it('«Agendado» mesmo que isLive venha true de uma leitura antiga', () => {
    expect(featureStatus(feature({ startsAt: FUTURE, isLive: true }), NOW)).toBe('scheduled');
  });

  it('«Loja não aprovada» só quando a loja não está aprovada', () => {
    for (const storeStatus of ['suspended', 'pending_approval', 'rejected', 'draft'] as const) {
      expect(featureStatus(feature({ storeStatus, isLive: false }), NOW)).toBe('store');
    }
    expect(featureStatus(feature({ storeStatus: 'approved', isLive: false }), NOW)).toBe('live');
  });

  it('«Desligado» quando não está ativo, mesmo dentro do período', () => {
    expect(featureStatus(feature({ isActive: false }), NOW)).toBe('off');
    expect(featureStatus(feature({ isActive: false, startsAt: FUTURE }), NOW)).toBe('off');
  });

  it('«Agendado» quando está ativo e o início ainda não chegou', () => {
    expect(featureStatus(feature({ startsAt: FUTURE }), NOW)).toBe('scheduled');
  });

  it('«Expirado» quando está ativo e o fim já passou', () => {
    expect(featureStatus(feature({ startsAt: PAST, endsAt: PAST }), NOW)).toBe('expired');
  });

  it('o fim exatamente agora já conta como expirado (período [início, fim))', () => {
    expect(featureStatus(feature({ endsAt: NOW.toISOString() }), NOW)).toBe('expired');
  });

  it('ativo, dentro do período, mas sem isLive: a loja não está aprovada', () => {
    expect(featureStatus(feature({ storeStatus: 'suspended' }), NOW)).toBe('store');
  });

  it('tem as etiquetas aprovadas', () => {
    expect(STATUS_LABEL).toEqual({
      live: 'No ar',
      scheduled: 'Agendado',
      expired: 'Expirado',
      off: 'Desligado',
      store: 'Loja não aprovada',
    });
  });
});

describe('periodLabel', () => {
  it('sem datas', () => {
    expect(periodLabel(feature(), NOW)).toBe('Sem datas');
  });

  it('só com fim no futuro: «Até …»', () => {
    expect(periodLabel(feature({ endsAt: FUTURE }), NOW)).toBe(`Até ${formatDateTime(FUTURE)}`);
  });

  it('só com início: «De …»', () => {
    expect(periodLabel(feature({ startsAt: FUTURE }), NOW)).toBe(`De ${formatDateTime(FUTURE)}`);
  });

  it('com início e fim no futuro: «De … até …»', () => {
    expect(periodLabel(feature({ startsAt: PAST, endsAt: FUTURE }), NOW)).toBe(
      `De ${formatDateTime(PAST)} até ${formatDateTime(FUTURE)}`,
    );
  });

  it('com o fim no passado: «Terminou em …»', () => {
    expect(periodLabel(feature({ startsAt: PAST, endsAt: PAST }), NOW)).toBe(
      `Terminou em ${formatDateTime(PAST)}`,
    );
  });
});

describe('SOURCE_LABEL', () => {
  it('a origem admin diz «Administração» e a paga «Promoção paga»', () => {
    expect(SOURCE_LABEL).toEqual({ admin: 'Administração', paid: 'Promoção paga' });
  });
});
