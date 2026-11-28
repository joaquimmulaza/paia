import { describe, expect, it } from 'vitest';
import { accountAgeLabel } from '@/features/admin/account-age';

// 2026-11-28 12:00 em Luanda (UTC+1).
const NOW = new Date('2026-11-28T11:00:00Z');

describe('accountAgeLabel', () => {
  it('conta criada no mesmo dia de Luanda', () => {
    expect(accountAgeLabel('2026-11-28T00:30:00+01:00', NOW)).toBe('conta criada hoje');
  });

  it('conta os dias pelo calendário de Luanda, não por 24 horas', () => {
    // 23:30 da véspera em Luanda: menos de 24 horas, mas já é «há 1 dia».
    expect(accountAgeLabel('2026-11-27T23:30:00+01:00', NOW)).toBe('conta criada há 1 dia');
    // 23:30 UTC do dia 27 já é dia 28 em Luanda.
    expect(accountAgeLabel('2026-11-27T23:30:00Z', NOW)).toBe('conta criada hoje');
  });

  it('dias no plural até 6', () => {
    expect(accountAgeLabel('2026-11-26T10:00:00+01:00', NOW)).toBe('conta criada há 2 dias');
    expect(accountAgeLabel('2026-11-22T10:00:00+01:00', NOW)).toBe('conta criada há 6 dias');
  });

  it('semanas completas a partir de 7 dias, singular e plural', () => {
    expect(accountAgeLabel('2026-11-21T10:00:00+01:00', NOW)).toBe('conta criada há 1 semana');
    expect(accountAgeLabel('2026-11-15T10:00:00+01:00', NOW)).toBe('conta criada há 1 semana');
    expect(accountAgeLabel('2026-11-14T10:00:00+01:00', NOW)).toBe('conta criada há 2 semanas');
    expect(accountAgeLabel('2026-11-07T10:00:00+01:00', NOW)).toBe('conta criada há 3 semanas');
  });

  it('uma data no futuro (relógio adiantado) conta como hoje', () => {
    expect(accountAgeLabel('2026-11-29T10:00:00+01:00', NOW)).toBe('conta criada hoje');
  });
});
