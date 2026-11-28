import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Os findBy/waitFor esperam até 1 s por omissão. Com a suite inteira a correr em paralelo, os
// ecrãs com várias consultas e rotas lazy passam disso (2,5 a 6 s). Subir o limite não torna
// nenhum teste mais lento: a espera acaba assim que a asserção passa, e só um teste que falha
// espera o tempo todo. Fica abaixo do `testTimeout` (15 s) para o erro ser o do Testing Library.
configure({ asyncUtilTimeout: 10_000 });

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
