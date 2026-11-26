import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Button', () => {
  it('com loading fica ocupado e desativado, mostra o indicador e mantém o texto', () => {
    render(<Button loading>A enviar…</Button>);
    const button = screen.getByRole('button', { name: 'A enviar…' });

    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    const spinner = button.querySelector('[data-slot="spinner"]');
    expect(spinner).not.toBeNull();
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
    expect(button).toHaveTextContent('A enviar…');
  });

  it('sem loading não tem indicador nem aria-busy', () => {
    render(<Button>Fazer pedido</Button>);
    const button = screen.getByRole('button', { name: 'Fazer pedido' });

    expect(button).not.toHaveAttribute('aria-busy');
    expect(button).toBeEnabled();
    expect(button.querySelector('[data-slot="spinner"]')).toBeNull();
  });

  it('variant="danger" usa o texto danger', () => {
    render(<Button variant="danger">Cancelar pedido</Button>);
    expect(screen.getByRole('button', { name: 'Cancelar pedido' })).toHaveClass('text-danger');
  });

  it('o primário é o botão por omissão (ink com sombra brand)', () => {
    render(<Button>Fazer pedido</Button>);
    const button = screen.getByRole('button', { name: 'Fazer pedido' });
    expect(button).toHaveClass('bg-ink', 'text-on-ink', 'shadow-hard-brand');
  });

  it('variant="icon" sem aria-label avisa na consola em desenvolvimento', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Button variant="icon">
        <svg aria-hidden="true" />
      </Button>,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('aria-label'));
  });

  it('variant="icon" com aria-label encontra-se pelo nome e não avisa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Button variant="icon" aria-label="Fechar">
        <svg aria-hidden="true" />
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    expect(warn).not.toHaveBeenCalled();
  });

  it('asChild com loading mantém um só elemento e põe o indicador lá dentro', () => {
    render(
      <Button asChild loading>
        <a href="/pedidos">A abrir…</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'A abrir…' });
    expect(link).toHaveAttribute('aria-busy', 'true');
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link.querySelector('[data-slot="spinner"]')).not.toBeNull();
  });
});
