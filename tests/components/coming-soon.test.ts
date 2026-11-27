import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.fn();
vi.mock('sonner', () => ({ toast: (...args: unknown[]) => toast(...args) }));

const { comingSoon } = await import('@/components/paia/ComingSoon');

describe('comingSoon', () => {
  beforeEach(() => {
    toast.mockClear();
  });

  it('mostra «Disponível em breve» durante 4 s', () => {
    comingSoon();
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      'Disponível em breve',
      expect.objectContaining({ duration: 4000 }),
    );
  });
});
