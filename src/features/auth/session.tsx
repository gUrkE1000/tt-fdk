import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  /** Woran `loading` gerade hängt — für die Fehlersuche auf fremden Geräten. */
  loadingDetail: string;
  /**
   * Angemeldet, aber ohne Mitgliedsprofil: etwa nach der endgültigen Löschung, solange
   * die Sitzung im Browser noch gilt. Die Anwendung zeigt dann keinen Verein, sondern
   * einen Hinweis.
   */
  profileMissing: boolean;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialising, setInitialising] = useState(true);
  const [previousLoginAt, setPreviousLoginAt] = useState<string | null>(null);
  // Für wen der „letzte Login" in dieser Sitzung schon geschrieben ist. Das Profil wird
  // öfter geladen (Fensterfokus, nach jedem Speichern); jedes Mal den Zeitpunkt zu
  // überschreiben, machte „seit deinem letzten Login" zu „seit vorhin".
  const touchedFor = useRef<string | null>(null);
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
      if (profile && touchedFor.current !== userId) {
        touchedFor.current = userId;
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
      loadingDetail: initialising
        ? 'auth getSession'
        : `profil ${profileQuery.status}/${profileQuery.fetchStatus}`,
      previousLoginAt,
      profileMissing: userId !== null && profileQuery.isSuccess && profileQuery.data === null,
    };
  }, [
    session,
    profileQuery.data,
    profileQuery.isLoading,
    profileQuery.status,
    profileQuery.fetchStatus,
    profileQuery.isSuccess,
    initialising,
    userId,
    previousLoginAt,
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession muss innerhalb von <SessionProvider> verwendet werden.');
  }
  return ctx;
}
