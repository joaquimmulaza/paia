import { useEffect, useState } from 'react';

/** A hora atual, atualizada a cada `intervalMs` enquanto o componente estiver montado. */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
