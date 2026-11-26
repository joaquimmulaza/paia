import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

function Entrega() {
  return (
    <RadioGroup aria-label="Entrega" defaultValue="sala">
      <RadioGroupItem value="sala">Entrega na sala</RadioGroupItem>
      <RadioGroupItem value="ponto">Ponto de encontro</RadioGroupItem>
      <RadioGroupItem value="combinar">Combinar com o vendedor</RadioGroupItem>
    </RadioGroup>
  );
}

describe('RadioGroup', () => {
  it('ArrowDown move o foco e a escolha do primeiro para o segundo', async () => {
    const user = userEvent.setup();
    render(<Entrega />);
    const primeiro = screen.getByRole('radio', { name: 'Entrega na sala' });
    const segundo = screen.getByRole('radio', { name: 'Ponto de encontro' });

    await user.tab();
    expect(primeiro).toHaveFocus();
    expect(primeiro).toHaveAttribute('data-state', 'checked');

    // O Radix move o foco num setTimeout e só escolhe se a seta ainda estiver premida,
    // como num teclado real: carregamos a tecla, esperamos pelo foco e só depois a largamos.
    await user.keyboard('{ArrowDown>}');
    await waitFor(() => expect(segundo).toHaveFocus());
    await user.keyboard('{/ArrowDown}');
    expect(segundo).toHaveAttribute('data-state', 'checked');
    expect(segundo).toBeChecked();
    expect(primeiro).toHaveAttribute('data-state', 'unchecked');
  });

  it('o item escolhido tem fundo brand-tint e texto em negrito', () => {
    render(<Entrega />);
    expect(screen.getByRole('radio', { name: 'Entrega na sala' })).toHaveClass(
      'data-[state=checked]:bg-brand-tint',
      'data-[state=checked]:font-bold',
    );
  });

  it('variant="card" usa o título como nome e a descrição como descrição', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup aria-label="Modalidade">
        <RadioGroupItem
          variant="card"
          value="sala"
          title="Entrega na sala"
          description="O vendedor leva o pedido à tua sala."
        />
        <RadioGroupItem
          variant="card"
          value="ponto"
          title="Ponto de encontro"
          description="Encontram-se num sítio combinado."
        />
      </RadioGroup>,
    );
    const card = screen.getByRole('radio', { name: 'Entrega na sala' });
    expect(card).toHaveAccessibleDescription('O vendedor leva o pedido à tua sala.');

    await user.click(screen.getByText('Ponto de encontro'));
    expect(screen.getByRole('radio', { name: 'Ponto de encontro' })).toHaveAttribute(
      'data-state',
      'checked',
    );
  });
});
