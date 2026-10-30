import { useEffect, useState } from 'react';

interface Settled<T> {
  key: string;
  data?: T;
  error?: Error;
}

/** Minimal data loader: re-runs when deps change, ignores stale responses. */
export function useFetch<T>(load: () => Promise<T>, deps: unknown[]): { data?: T; error?: Error; loading: boolean } {
  const key = JSON.stringify(deps);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setSettled({ key, data }),
      (error: Error) => live && setSettled({ key, error }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Until the request for the current deps settles, report loading rather than stale data.
  if (settled?.key !== key) return { loading: true };
  return { data: settled.data, error: settled.error, loading: false };
}
