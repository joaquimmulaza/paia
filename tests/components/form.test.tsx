import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

function Telefone() {
  const form = useForm<{ phone: string }>({ defaultValues: { phone: '' } });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})} noValidate>
        <FormField
          control={form.control}
          name="phone"
          rules={{ required: 'Escreve o teu número de telefone.' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone</FormLabel>
              <FormControl>
                <Input inputMode="tel" {...field} />
              </FormControl>
              <FormDescription>9 algarismos, começa por 9.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Continuar</button>
      </form>
    </Form>
  );
}

function DescricaoTardia() {
  const form = useForm<{ name: string }>({ defaultValues: { name: '' } });
  const [hint, setHint] = useState(false);
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            {hint && <FormDescription>Até 40 caracteres.</FormDescription>}
          </FormItem>
        )}
      />
      <button type="button" onClick={() => setHint(true)}>
        Mostrar ajuda
      </button>
    </Form>
  );
}

describe('Form', () => {
  it('uma descrição que aparece depois da montagem fica ligada ao campo', async () => {
    const user = userEvent.setup({ delay: null });
    render(<DescricaoTardia />);
    await user.click(screen.getByRole('button', { name: 'Mostrar ajuda' }));
    expect(screen.getByLabelText('Nome')).toHaveAccessibleDescription('Até 40 caracteres.');
  });

  it('liga o rótulo e a descrição ao campo', () => {
    render(<Telefone />);
    const input = screen.getByLabelText('Telefone');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).toHaveAccessibleDescription('9 algarismos, começa por 9.');
  });

  it('com erro marca o campo e mostra a mensagem com ícone, ligada ao campo', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Telefone />);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    const input = screen.getByLabelText('Telefone');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      '9 algarismos, começa por 9. Escreve o teu número de telefone.',
    );
    const message = screen.getByText('Escreve o teu número de telefone.');
    expect(message).toHaveClass('text-danger');
    expect(message.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});
