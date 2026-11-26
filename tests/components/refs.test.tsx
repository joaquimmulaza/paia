import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

// Em React 18 um componente de função só recebe `ref` com forwardRef. Sem isto o
// react-hook-form não consegue pôr o foco no primeiro campo com erro.
describe('refs dos campos', () => {
  it('Input passa o ref para o <input>', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="Nome" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('Checkbox passa o ref para o botão', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Checkbox ref={ref} aria-label="Aceito" />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
