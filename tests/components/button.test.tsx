import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, buttonVariants } from '@/components/ui/button';

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

  it.each([
    ['loading', { loading: true }],
    ['disabled', { disabled: true }],
  ])(
    'asChild <a> com %s sai da ordem do Tab e não se ativa com clique nem com Enter',
    async (_, state) => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Button asChild {...state}>
          <a href="#pedidos" onClick={onClick}>
            Ver pedidos
          </a>
        </Button>,
      );
      const link = screen.getByRole('link', { name: 'Ver pedidos' });
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(link).toHaveAttribute('aria-disabled', 'true');

      const clickEvent = createEvent.click(link);
      fireEvent(link, clickEvent);
      expect(clickEvent.defaultPrevented).toBe(true);
      expect(onClick).not.toHaveBeenCalled();

      link.focus();
      await user.keyboard('{Enter}');
      expect(onClick).not.toHaveBeenCalled();
      expect(window.location.hash).not.toBe('#pedidos');
    },
  );

  it('asChild desativado (não a carregar) tem o aspeto tracejado; a carregar não', () => {
    render(
      <>
        <Button asChild disabled>
          <a href="#a">Desativado</a>
        </Button>
        <Button asChild loading>
          <a href="#b">A abrir…</a>
        </Button>
      </>,
    );
    const cls = 'aria-disabled:not-aria-busy:border-dashed';
    expect(screen.getByRole('link', { name: 'Desativado' })).toHaveClass(cls);
    expect(screen.getByRole('link', { name: 'Desativado' })).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('link', { name: 'A abrir…' })).toHaveAttribute('aria-busy', 'true');
  });
});

describe('buttonVariants', () => {
  it('usado sozinho não devolve classes em conflito', () => {
    const icon = buttonVariants({ variant: 'icon' }).split(' ');
    expect(icon.filter((c) => c.startsWith('min-h-'))).toEqual(['min-h-11']);
    expect(icon.filter((c) => /^px-/.test(c))).toEqual(['px-0']);
  });
});
