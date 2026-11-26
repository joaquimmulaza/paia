import type { ReactNode } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { safeRedirect } from '@/features/auth/redirect';

/** Só com sessão. Sem sessão vai para /entrar e guarda a rota em `?voltar=`. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  // Enquanto o Supabase lê a sessão guardada, não mostra nada: evita piscar o formulário de entrada.
  if (loading) return null;
  if (!session) {
    const voltar = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/entrar?${new URLSearchParams({ voltar })}`} replace />;
  }
  return <>{children}</>;
}

/** Só sem sessão (entrar, criar conta). Com sessão segue para o `voltar` seguro, ou /perfil. */
export function RequireGuest({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const [params] = useSearchParams();

  if (loading) return null;
  if (session) return <Navigate to={safeRedirect(params.get('voltar'))} replace />;
  return <>{children}</>;
}
