import { useQuery } from '@tanstack/react-query';
import { supabase, APP_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../lib/supabaseClient';
import type { Tables } from '../../lib/database.types';

export type Profile = Tables<'profiles'>;

/**
 * Wie lange auf eine Antwort gewartet wird, bevor aufgegeben wird.
 *
 * Ohne Abbruch wartet `fetch` so lange, wie das Betriebssystem es zulässt — bei einer
 * Verbindung, die aufgebaut, aber nicht beantwortet wird, sind das Minuten. Eine Seite,
 * deren einzige Anzeige währenddessen ein Ladekringel ist, sieht dabei kaputt aus und
 * sagt nicht, woran es liegt. Zwölf Sekunden sind lang genug für ein schlechtes Mobilnetz
 * und kurz genug, dass niemand sie für einen Absturz hält.
 */
const QUERY_TIMEOUT_MS = 12_000;

/**
 * Eine Datenbankfunktion aufrufen, ohne den Supabase-Client.
 *
 * Für die zwei Aufrufe, die **vor** jeder Anmeldung laufen: Vereinsname und Prüfung des
 * Registrierungscodes. Beide sind `SECURITY DEFINER` und für `anon` freigegeben und
 * brauchen deshalb keinen Anmeldezustand — ohne den Client ist der Weg dorthin kürzer und
 * vor allem beobachtbar.
 *
 * Der ursprüngliche Verdacht, der Client stelle gleichzeitige Aufrufe hinter einem Schloss
 * an (`_acquireLock` in auth-js), hat sich **nicht** bestätigt: Mit diesem Weg hing die
 * Registrierungsseite genauso. Die Umstellung bleibt trotzdem — sie nimmt eine Schicht aus
 * dem Spiel, die hier nichts beizutragen hat, und erlaubt erst die Schrittanzeige unten.
 */
async function publicRpc(name: string, params: Record<string, unknown>): Promise<unknown> {
  /*
    Wie weit der Aufruf gekommen ist. Das Abbruchsignal des `fetch` allein hat sich als
    unzuverlässig erwiesen — die Seite blieb im Ladezustand stehen, obwohl zwölf Sekunden
    längst um waren. Deshalb hier ein zweiter, davon unabhängiger Riegel, und mit ihm die
    Auskunft, an welchem Schritt es lag. Ein „hängt" ohne Ortsangabe kostet jedes Mal eine
    weitere Runde.
  */
  const progress = { step: 'start' };

  const work = (async (): Promise<unknown> => {
    progress.step = 'fetch';
    let response: Response;

    try {
      response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
      });
    } catch (error) {
      // Abgebrochen oder kein Netz — beides braucht einen Satz, den man vorlesen kann.
      throw readableError({ message: error instanceof Error ? error.message : 'abort' });
    }

    progress.step = `http-${response.status}`;

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      throw readableError({
        message: body.message ?? `HTTP ${response.status}`,
        code: body.code ?? (response.status === 404 ? 'PGRST202' : undefined),
      });
    }

    const parsed = await response.json();
    progress.step = 'fertig';
    return parsed;
  })();

  return await guard(work, () => progress.step);
}

/**
 * Bricht ab, wenn nach `QUERY_TIMEOUT_MS` nichts da ist — und sagt, wobei.
 *
 * Der eigene Zeitmesser läuft neben der Arbeit her und ist von ihr unabhängig. Genau
 * darauf kommt es an: Ein Abbruchsignal, das im Anfragepfad selbst steckt, nützt nichts,
 * wenn der Pfad es nicht auswertet.
 */
async function guard<T>(work: Promise<T>, where: () => string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Keine Antwort vom Server (bei „${where()}").`)),
          QUERY_TIMEOUT_MS + 1000,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Gibt auf, wenn nach `QUERY_TIMEOUT_MS` keine Antwort da ist.
 *
 * Für Aufrufe, die über den Supabase-Client laufen müssen (weil sie einen Anmeldezustand
 * brauchen) und deshalb kein eigenes Abbruchsignal bekommen können. Die Anfrage selbst
 * läuft im Hintergrund zu Ende — worum es geht, ist die Anzeige: Sie muss zu einem Ende
 * kommen. Wo ein `fetch` direkt möglich ist, ist `publicRpc` das bessere Mittel.
 */
export async function withTimeout<T>(work: PromiseLike<T>, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `Der Server hat beim ${what} nicht geantwortet. Prüfe die Internetverbindung und versuche es noch einmal.`,
              ),
            ),
          QUERY_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Aus einem Supabase-Fehler einen Satz machen, der jemandem ohne Entwicklerwerkzeuge
 * weiterhilft. Die Originalmeldung bleibt erhalten — sie ist das, was man vorzeigen kann.
 */
export function readableError(error: { message?: string; code?: string }): Error {
  const message = error.message ?? '';

  if (/abort|timeout|signal/i.test(message)) {
    return new Error(
      'Der Server hat nicht geantwortet. Prüfe die Internetverbindung und versuche es noch einmal.',
    );
  }

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return new Error('Keine Verbindung zum Server. Bist du online?');
  }

  // PGRST202: Die Funktion gibt es in der Datenbank nicht (oder PostgREST kennt sie noch
  // nicht). Das ist ein Einrichtungsfehler und keiner, den ein Mitglied lösen kann.
  if (error.code === 'PGRST202') {
    return new Error(
      'Die Anwendung ist noch nicht fertig eingerichtet. Bitte beim Administrator des Vereins melden.',
    );
  }

  return new Error(message || 'Unbekannter Fehler');
}

/**
 * Anmeldelink anfordern.
 *
 * shouldCreateUser: false ist die wichtigste Zeile dieser Datei. Ohne sie könnte sich
 * jede beliebige E-Mail-Adresse ein Konto verschaffen; so bekommt nur jemand einen Link,
 * den der Verein kennt. Neue Mitglieder kommen über Einladung oder Registrierungscode.
 */
export async function requestMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: APP_URL,
      shouldCreateUser: false,
    },
  });

  if (error) {
    // Supabase meldet den unbekannten Benutzer je nach Version unterschiedlich.
    if (/signups? not allowed|user not found/i.test(error.message)) {
      throw new Error(
        'Diese E-Mail-Adresse ist im Verein nicht bekannt. Bitte beim Administrator melden oder den Registrierungslink des Vereins nutzen.',
      );
    }
    throw error;
  }
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    throw new Error('E-Mail-Adresse oder Passwort stimmen nicht.');
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${APP_URL}/profile`,
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  registrationCode: string;
}

/**
 * Selbstregistrierung über den Vereinscode. Der Trigger handle_new_user() prüft den Code
 * noch einmal in der Datenbank — die Prüfung hier ist nur für eine frühe Fehlermeldung.
 */
export async function registerWithCode(input: RegisterInput): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: input.email.trim(),
    // Ohne Passwort trotzdem eines vergeben: Supabase verlangt es beim signUp. Das Konto
    // wird danach ohnehin per Magic Link genutzt.
    password: input.password || crypto.randomUUID(),
    options: {
      emailRedirectTo: APP_URL,
      data: {
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        registration_code: input.registrationCode,
      },
    },
  });

  if (error) {
    if (/nicht bekannt|Registrierungslink/i.test(error.message)) {
      throw new Error(error.message);
    }
    if (/already registered/i.test(error.message)) {
      throw new Error('Für diese E-Mail-Adresse gibt es bereits ein Konto. Bitte anmelden.');
    }
    throw error;
  }
}

export async function validateRegistrationCode(code: string): Promise<boolean> {
  return (await publicRpc('rpc_validate_registration_code', { p_code: code })) === true;
}

export interface PublicClubInfo {
  club_name: string;
  club_short_name: string;
  /** Adresse des Datenschutzhinweises; leer, solange der Verein keinen hinterlegt hat. */
  privacy_url?: string;
  imprint_url?: string;
}

/** Vereinsname für Anmeldung und Registrierung — abrufbar, bevor jemand angemeldet ist. */
export function usePublicClubInfo() {
  return useQuery({
    queryKey: ['public-club-info'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PublicClubInfo> => {
      const data = await publicRpc('get_public_club_info', {});
      const row = Array.isArray(data) ? data[0] : data;
      return (row as PublicClubInfo) ?? { club_name: 'Vereinsplaner', club_short_name: 'Verein' };
    },
  });
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await withTimeout(
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    'Laden des Profils',
  );
  if (error) throw readableError(error);
  return data;
}

/** Hält fest, wann jemand zuletzt da war — Grundlage für „seit deinem letzten Login". */
export async function touchLastLogin(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userId);
}
