import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/features/auth/AuthProvider';

/** Uma só nova tentativa: com a rede em baixo, o erro aparece em ~1 s em vez de ~7 s. */
export function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {/* Ao mudar de conta, nada da anterior pode aparecer (por exemplo num aparelho partilhado). */}
      <AuthProvider onUserChange={() => queryClient.clear()}>
        {children}
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
