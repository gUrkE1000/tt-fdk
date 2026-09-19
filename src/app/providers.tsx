import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ToastProvider } from '../components/ui';
import { SessionProvider } from '../features/auth/session';

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
  /*
    `useState` mit Erzeugerfunktion, nicht `createQueryClient()` direkt im Rumpf: Sonst
    entstünde bei jedem Render ein neuer Client, jede laufende Abfrage verlöre ihren
    Platz, und Seiten, die auf ein Ergebnis warten, kämen nie aus dem Ladezustand
    heraus. Heute rendert `App` genau einmal, der Fehler bliebe also unsichtbar — bis
    jemand dort einen Zustand ergänzt.
  */
  const [created] = useState(createQueryClient);
  const client = queryClient ?? created;
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider>{children}</SessionProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
