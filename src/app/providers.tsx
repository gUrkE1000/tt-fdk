import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ConfirmProvider, ToastProvider } from '../components/ui';
import { SessionProvider, useSession } from '../features/auth/session';
import { clearPersistedCaches, restoreCache, startPersisting } from '../lib/queryPersist';

/**
 * staleTime 30 s: Vereinsdaten ändern sich selten im Sekundentakt, aber oft genug, dass
 * ein Wechsel zwischen zwei Seiten keine frischen Daten braucht. retry 1, weil ein zweiter
 * Fehlversuch bei RLS-Verweigerungen nichts bringt und den Fehler nur verzögert.
 *
 * refetchOnWindowFocus: Wer die installierte App morgens wieder öffnet, soll nicht den
 * Stand von gestern Abend sehen. Früher war das aus — und weil Kopfzeile, Menü und die
 * gerade offene Seite dabei nicht neu eingehängt werden, blieb alles stehen, bis man
 * die Seite wechselte. Mit staleTime lädt ein kurzer Blick in eine andere App nichts
 * neu; erst nach 30 Sekunden.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        // Einen Tag im Speicher halten statt fünf Minuten: Was nicht mehr im
        // Zwischenspeicher ist, kann auch nicht fürs Offline-Öffnen gesichert werden.
        gcTime: 24 * 60 * 60 * 1000,
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
        <ConfirmProvider>
          <SessionProvider>
            {/* Tests bringen ihren eigenen Client mit und sollen sich nichts merken. */}
            {!queryClient && <CachePersistence client={client} />}
            {children}
          </SessionProvider>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

/**
 * Hält den letzten Stand des angemeldeten Mitglieds auf dem Gerät (siehe
 * `lib/queryPersist.ts`): beim Anmelden laden, danach laufend sichern, beim Abmelden
 * löschen.
 */
function CachePersistence({ client }: { client: QueryClient }) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      if (previous.current) clearPersistedCaches();
      previous.current = null;
      return;
    }
    previous.current = userId;
    restoreCache(client, userId);
    return startPersisting(client, userId);
  }, [client, userId]);

  return null;
}
