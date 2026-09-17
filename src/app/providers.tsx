import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * staleTime 30 s: Vereinsdaten ändern sich selten im Sekundentakt, aber oft genug, dass
 * ein Wechsel zwischen zwei Seiten keine frischen Daten braucht. retry 1, weil ein zweiter
 * Fehlversuch bei RLS-Verweigerungen nichts bringt und den Fehler nur verzögert.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

interface ProvidersProps {
  children: ReactNode;
  /** In Tests wird ein eigener Client übergeben, damit sich Tests nicht gegenseitig sehen. */
  queryClient?: QueryClient;
}

export default function Providers({ children, queryClient }: ProvidersProps) {
  const client = queryClient ?? createQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
