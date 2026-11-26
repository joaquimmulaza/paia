import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  /**
   * Corre quando o utilizador da sessão muda (saiu, ou entrou outra conta), antes de o
   * novo estado chegar aos ecrãs. Serve para limpar dados em cache da conta anterior.
   * Não corre no refresh do token nem na primeira leitura da sessão.
   */
  onUserChange?: () => void;
}

export function AuthProvider({ children, onUserChange }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });
  const onUserChangeRef = useRef(onUserChange);
  onUserChangeRef.current = onUserChange;

  useEffect(() => {
    let active = true;
    // undefined = ainda não sabemos quem é; null = sem sessão.
    let userId: string | null | undefined;
    const track = (session: Session | null) => {
      const next = session?.user.id ?? null;
      if (userId !== undefined && next !== userId) onUserChangeRef.current?.();
      userId = next;
    };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      track(session);
      setState({ session, loading: false });
    });
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!active || userId !== undefined) return;
        track(session);
        setState((prev) => (prev.loading ? { session, loading: false } : prev));
      })
      .catch(() => {
        if (active) setState((prev) => (prev.loading ? { session: null, loading: false } : prev));
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth tem de ser usado dentro de <AuthProvider>.');
  return ctx;
}
