import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { fetchProfile, touchLastLogin, withTimeout, type Profile } from './api';
import type { Role } from '../../app/nav';

export interface SessionState {
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  /** Solange true, steht noch nicht fest, ob jemand angemeldet ist. */
  loading: boolean;
  /** Zeitpunkt der vorletzten Anmeldung — Grundlage für „seit deinem letzten Login". */
  previousLoginAt: string | null;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialising, setInitialising] = useState(true);
  const [previousLoginAt, setPreviousLoginAt] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    /*
      `getSession()` liest die gespeicherte Sitzung und erneuert sie bei Bedarf über das
      Netz. Bleibt diese Erneuerung hängen, wird die Zusage nie eingelöst — und weil
      `initialising` daran hängt, zeigt `RequireAuth` bis in alle Ewigkeit einen
      Ladekringel. Das ist die einzige Stelle der Anmeldung, die noch ohne zeitliche
      Grenze auskam.

      Nach Ablauf wird weitergemacht, nicht abgebrochen: Ohne Sitzung landet man auf der
      Anmeldeseite, und die ist eine brauchbare Auskunft. Ein Kringel ist keine.
    */
    void withTimeout(supabase.auth.getSession(), 'Prüfen der Anmeldung')
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session ?? null);
      })
      .catch(() => {
        /* Abgelaufen oder gescheitert — beides heißt: nicht angemeldet. */
      })
      .finally(() => {
        if (active) setInitialising(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setInitialising(false);
      if (!next) {
        // Nach dem Abmelden darf nichts aus dem Zwischenspeicher zurückkommen.
        queryClient.clear();
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user.id ?? null;

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: userId !== null,
    queryFn: async () => {
      const profile = await fetchProfile(userId!);
      if (profile) {
        // Erst merken, dann überschreiben: sonst wäre der „letzte Login" immer jetzt.
        setPreviousLoginAt(profile.last_login_at);
        void touchLastLogin(userId!);
      }
      return profile;
    },
  });

  const value = useMemo<SessionState>(() => {
    const profile = profileQuery.data ?? null;
    return {
      session,
      profile,
      role: (profile?.role as Role | undefined) ?? null,
      loading: initialising || (userId !== null && profileQuery.isLoading),
      previousLoginAt,
    };
  }, [session, profileQuery.data, profileQuery.isLoading, initialising, userId, previousLoginAt]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession muss innerhalb von <SessionProvider> verwendet werden.');
  }
  return ctx;
}
