import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sem globais no Vitest, o Testing Library não limpa sozinho entre testes.
afterEach(() => {
  cleanup();
});

// O jsdom não tem ResizeObserver; o Radix usa-o para medir a caixa e o botão de opção.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
