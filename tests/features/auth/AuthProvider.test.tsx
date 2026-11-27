import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state: { listener?: (event: string, session: unknown) => void } = {};
  const getSession = vi.fn();
  const unsubscribe = vi.fn();
  const onAuthStateChange = vi.fn((cb: (event: string, session: unknown) => void) => {
    state.listener = cb;
    return { data: { subscription: { unsubscribe } } };
  });
  return { state, getSession, unsubscribe, onAuthStateChange };
});
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange } },
}));

import { AuthProvider, currentUserId, useAuth } from '@/features/auth/AuthProvider';

function Probe() {
  const { session, loading } = useAuth();
  return <p>{loading ? 'a carregar' : session ? 'com sessão' : 'sem sessão'}</p>;
}

function mount() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.listener = undefined;
});

describe('AuthProvider', () => {
  it('começa a carregar e depois mostra a sessão obtida', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mount();
    expect(screen.getByText('a carregar')).toBeInTheDocument();
    expect(await screen.findByText('com sessão')).toBeInTheDocument();
  });

  it('sem sessão acaba de carregar', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mount();
    expect(await screen.findByText('sem sessão')).toBeInTheDocument();
  });

  it('acompanha onAuthStateChange e anula a subscrição ao desmontar', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    const { unmount } = mount();
    await screen.findByText('sem sessão');
    act(() => mocks.state.listener?.('SIGNED_IN', { user: { id: 'u1' } }));
    await waitFor(() => expect(screen.getByText('com sessão')).toBeInTheDocument());
    act(() => mocks.state.listener?.('SIGNED_OUT', null));
    await waitFor(() => expect(screen.getByText('sem sessão')).toBeInTheDocument());
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('se getSession falhar, deixa de carregar sem sessão', async () => {
    mocks.getSession.mockRejectedValue(new Error('rede'));
    mount();
    expect(await screen.findByText('sem sessão')).toBeInTheDocument();
  });

  it('onUserChange corre quando o utilizador muda (sair, entrar com outro), não no refresh do token', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    const onUserChange = vi.fn();
    render(
      <AuthProvider onUserChange={onUserChange}>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText('com sessão');
    expect(onUserChange).not.toHaveBeenCalled();

    act(() => mocks.state.listener?.('TOKEN_REFRESHED', { user: { id: 'u1' } }));
    expect(onUserChange).not.toHaveBeenCalled();

    act(() => mocks.state.listener?.('SIGNED_OUT', null));
    expect(onUserChange).toHaveBeenCalledTimes(1);

    act(() => mocks.state.listener?.('SIGNED_IN', { user: { id: 'u2' } }));
    expect(onUserChange).toHaveBeenCalledTimes(2);
  });

  it('useAuth fora do provider lança', () => {
    // O React volta a lançar o erro no window; silencia o ruído sem esconder a asserção.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const swallow = (e: ErrorEvent) => e.preventDefault();
    window.addEventListener('error', swallow);
    expect(() => render(<Probe />)).toThrow(/AuthProvider/);
    window.removeEventListener('error', swallow);
    spy.mockRestore();
  });
});

describe('currentUserId', () => {
  it('segue o utilizador da sessão fora do React, e volta a null ao desmontar', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    const { unmount } = mount();
    await screen.findByText('com sessão');
    expect(currentUserId()).toBe('u1');
    act(() => mocks.state.listener?.('SIGNED_IN', { user: { id: 'u2' } }));
    expect(currentUserId()).toBe('u2');
    act(() => mocks.state.listener?.('SIGNED_OUT', null));
    expect(currentUserId()).toBeNull();
    act(() => mocks.state.listener?.('SIGNED_IN', { user: { id: 'u3' } }));
    unmount();
    expect(currentUserId()).toBeNull();
  });
});
