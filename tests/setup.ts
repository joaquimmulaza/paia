import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sem globais no Vitest, o Testing Library não limpa sozinho entre testes.
afterEach(() => {
  cleanup();
});
