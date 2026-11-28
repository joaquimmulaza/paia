import { describe, expect, it } from 'vitest';
import { firstName, shortPersonName } from '@/features/admin/person-name';

describe('shortPersonName', () => {
  it('primeiro nome e a inicial do último apelido, como no A01 («Ana P.»)', () => {
    expect(shortPersonName('Ana Paula')).toBe('Ana P.');
    expect(shortPersonName('Ana Paula da Silva')).toBe('Ana S.');
  });

  it('um nome só fica como está', () => {
    expect(shortPersonName('Ana')).toBe('Ana');
  });

  it('ignora espaços a mais, também entre os nomes', () => {
    expect(shortPersonName('  Rita   Mendes  ')).toBe('Rita M.');
    expect(shortPersonName('Rita Mendes')).toBe('Rita M.');
  });

  it('mantém a inicial acentuada e põe-na em maiúscula', () => {
    expect(shortPersonName('Ana Ávila')).toBe('Ana Á.');
    expect(shortPersonName('joão évora')).toBe('joão É.');
  });

  it('um apelido já abreviado não leva outro ponto', () => {
    expect(shortPersonName('Admin J.')).toBe('Admin J.');
  });

  it('vazio dá vazio', () => {
    expect(shortPersonName('   ')).toBe('');
  });
});

describe('firstName', () => {
  it('o primeiro nome, sem espaços', () => {
    expect(firstName('  Ana   Paula ')).toBe('Ana');
    expect(firstName('Ana')).toBe('Ana');
  });
});
