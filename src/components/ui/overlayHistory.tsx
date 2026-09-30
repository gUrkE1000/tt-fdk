import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Zurückwischen schließt zuerst den offenen Dialog.
 *
 * Am Telefon ist die Geste vom Rand der Weg zurück. Ein Dialog („Aufstellung teilen",
 * „Spieler verwalten", das Menü …) hatte aber keinen eigenen Eintrag im Verlauf: Die
 * Geste schloss ihn nicht, sondern verließ die Seite darunter — oft bis zur Übersicht.
 *
 * Jetzt legt jeder offene Dialog einen Eintrag an: dieselbe Adresse, im Zustand des
 * Eintrags eine Marke (`overlays`). Zurück nimmt den Eintrag weg, der Dialog sieht seine
 * Marke verschwinden und schließt sich. Schließt man ihn selbst (Kreuz, Speichern,
 * Escape), geht die App den Schritt zurück, damit kein toter Eintrag übrig bleibt.
 *
 * Ohne Provider (Tests einzelner Komponenten, Seiten außerhalb der App-Hülle) verhalten
 * sich Dialoge wie bisher.
 */

interface OverlayHistory {
  /** Die Marken im aktuellen Eintrag, der oberste Dialog zuletzt. */
  overlays: readonly string[];
  push: (token: string) => void;
  release: (token: string) => void;
}

const OverlayHistoryContext = createContext<OverlayHistory | null>(null);

function overlaysOf(state: unknown): string[] {
  const list = (state as { overlays?: unknown } | null)?.overlays;
  return Array.isArray(list) ? list.filter((entry): entry is string => typeof entry === 'string') : [];
}

/** So lange wartet ein neuer Dialog höchstens darauf, dass ein Schritt zurück ankommt. */
const POP_TIMEOUT_MS = 1000;

export function OverlayHistoryProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Der zuletzt bekannte Eintrag. `pending` sind die Marken, wie sie nach den eigenen,
  // noch nicht gerenderten Navigationen aussehen werden.
  const current = useRef(location);
  const pending = useRef(overlaysOf(location.state));
  const releasing = useRef(new Set<string>());
  const popping = useRef(false);
  const waiting = useRef<(() => void)[]>([]);

  const flushWaiting = () => {
    popping.current = false;
    const queued = waiting.current;
    waiting.current = [];
    queued.forEach((run) => run());
  };

  useLayoutEffect(() => {
    current.current = location;
    pending.current = overlaysOf(location.state);
    flushWaiting();
  }, [location]);

  // Nach dem Neuladen gibt es die Dialoge der Marken nicht mehr. Ohne Aufräumen wäre
  // der Eintrag ein toter Schritt: Zurück täte scheinbar nichts.
  useEffect(() => {
    if (overlaysOf(current.current.state).length === 0) return;
    go([], true);
    // Nur beim ersten Rendern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(overlays: string[], replace: boolean) {
    const loc = current.current;
    // `focus` gehört zu genau einem Eintrag (useScrollToFocus); kopiert würde die Liste
    // beim Öffnen jedes Dialogs wieder zum Termin springen.
    const { focus: _focus, overlays: _overlays, ...rest } = (loc.state ?? {}) as Record<string, unknown>;
    pending.current = overlays;
    navigate(
      { pathname: loc.pathname, search: loc.search, hash: loc.hash },
      { replace, state: overlays.length > 0 ? { ...rest, overlays } : rest },
    );
  }

  function flushRelease() {
    if (releasing.current.size === 0) return;
    const list = pending.current;
    let count = 0;
    while (count < list.length && releasing.current.has(list[list.length - 1 - count])) count++;
    releasing.current.clear();
    if (count === 0) return;

    pending.current = list.slice(0, list.length - count);
    popping.current = true;
    window.setTimeout(() => popping.current && flushWaiting(), POP_TIMEOUT_MS);
    navigate(-count);
  }

  const api = useRef<Pick<OverlayHistory, 'push' | 'release'>>({
    push(token) {
      const run = () => {
        const list = pending.current;
        const top = list[list.length - 1];
        // Ein Dialog geht zu, im selben Zug geht ein anderer auf (Bestätigung nach dem
        // Bearbeiten …): den Eintrag weiterverwenden statt zurück und wieder vor.
        if (top !== undefined && releasing.current.has(top)) {
          releasing.current.delete(top);
          go([...list.slice(0, -1), token], true);
        } else {
          go([...list, token], false);
        }
      };
      // Ein Schritt zurück ist unterwegs: erst danach vorwärts, sonst landet der neue
      // Eintrag hinter dem, der gerade verschwindet.
      if (popping.current) waiting.current.push(run);
      else run();
    },
    release(token) {
      if (!pending.current.includes(token)) return;
      releasing.current.add(token);
      // Gesammelt, damit mehrere Dialoge, die zugleich zugehen, ein Schritt sind.
      queueMicrotask(flushRelease);
    },
  });

  const overlays = useMemo(() => overlaysOf(location.state), [location.state]);
  const value = useMemo<OverlayHistory>(
    () => ({ overlays, push: (token) => api.current.push(token), release: (token) => api.current.release(token) }),
    [overlays],
  );

  return <OverlayHistoryContext.Provider value={value}>{children}</OverlayHistoryContext.Provider>;
}

/**
 * Hängt einen Dialog an den Verlauf: offen heißt ein eigener Eintrag, Zurück ruft
 * `onClose`.
 *
 * Gibt zurück, ob der Eintrag gerade obenauf liegt. Wer aus dem Dialog heraus woandershin
 * navigiert, ersetzt dann besser diesen Eintrag (`replace`), statt einen weiteren
 * anzulegen — sonst stünde die Seite von vorhin zweimal im Verlauf.
 */
export function useCloseOnBack(open: boolean, onClose: () => void): boolean {
  const history = useContext(OverlayHistoryContext);
  const token = useId();

  const historyRef = useRef(history);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    historyRef.current = history;
    onCloseRef.current = onClose;
  });

  const pushed = useRef(false);
  const seen = useRef(false);

  useEffect(() => {
    const api = historyRef.current;
    if (!api) return;
    if (open && !pushed.current) {
      pushed.current = true;
      seen.current = false;
      api.push(token);
    } else if (!open && pushed.current) {
      pushed.current = false;
      api.release(token);
    }
  }, [open, token]);

  const present = history?.overlays.includes(token) ?? false;

  useEffect(() => {
    if (!pushed.current) return;
    if (present) {
      seen.current = true;
    } else if (seen.current) {
      // Die Marke war da und ist weg: Jemand ist zurückgegangen.
      seen.current = false;
      pushed.current = false;
      onCloseRef.current();
    }
  }, [present]);

  // Verschwindet der Dialog samt Komponente, während er offen ist.
  useEffect(
    () => () => {
      if (!pushed.current) return;
      pushed.current = false;
      historyRef.current?.release(token);
    },
    [token],
  );

  return present && history?.overlays[history.overlays.length - 1] === token;
}
