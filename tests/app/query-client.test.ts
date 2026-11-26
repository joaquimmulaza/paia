import { describe, expect, it } from 'vitest';
import { createQueryClient } from '@/app/providers';

describe('createQueryClient', () => {
  it('tenta só uma vez de novo, para o erro aparecer depressa', () => {
    expect(createQueryClient().getDefaultOptions().queries?.retry).toBe(1);
  });
});
