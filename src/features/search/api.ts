import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { mapsUrl } from '../../lib/maps';
import { notificationTarget } from '../../lib/notificationTarget';
import { matchesSearch, searchable, searchTokens } from '../../lib/search';
import type { Role } from '../../app/nav';
import { parseQuery, type QueryRange } from './parseQuery';
import { searchPages } from './pages';
import { KINDS, type SearchHit, type SearchKind } from './types';

/** So lange wartet die Sofortliste nach dem letzten Tastendruck. */
export const DEBOUNCE_MS = 150;

/** Eine Zeile aus `rpc_search`. Die generierten Typen kennen RPC-Rückgaben nicht genauer. */
interface RpcRow {
  kind: string;
  id: string;
  title: string | null;
  subtitle: string | null;
  starts_at: string | null;
  target: string | null;
  score: number;
  mine: boolean;
  my_status: string | null;
  can_manage: boolean;
  meta: Record<string, unknown> | null;
}

export type TimeFilter = 'all' | 'upcoming' | 'past';

export interface SearchRequest {
  query: string;
  /** Leer = alle Arten. */
  kinds?: SearchKind[];
  time?: TimeFilter;
  /** Treffer je Art. */
  limit?: number;
}

export interface SearchResult {
  hits: SearchHit[];
  /** Erkannte Zeitangabe, für den Hinweis über der Liste. */
  range: QueryRange | null;
  /** Ohne Netz aus dem gespeicherten Stand gesucht. */
  offline: boolean;
}

/** Wandelt eine Zeile der Datenbank in einen Treffer. */
export function toHit(row: RpcRow, origin: string): SearchHit {
  const kind = row.kind as SearchKind;
  const meta = row.meta ?? {};
  let target = row.target ?? '';
  let external = false;

  if (kind === 'venue') {
    // Orte haben keine eigene Seite; der Treffer führt zur Route.
    target = mapsUrl(typeof meta.address === 'string' ? meta.address : row.subtitle) ?? '';
    external = target !== '';
  }
  if (kind === 'notification') {
    // Adressen aus Mitteilungen nur innerhalb der App — wie beim Antippen einer Push.
    target = notificationTarget(target, origin, '/notifications');
  }

  return {
    kind,
    id: row.id,
    title: row.title ?? '',
    subtitle: row.subtitle,
    startsAt: row.starts_at,
    target,
    external,
    score: Number(row.score) * (KINDS[kind]?.weight ?? 1),
    mine: row.mine,
    myStatus: row.my_status,
    canManage: row.can_manage,
    meta,
  };
}

/** Zeitraum aus Eingabe und Zeitfilter. Eine Zeitangabe in der Eingabe hat Vorrang. */
export function effectiveRange(
  range: QueryRange | null,
  time: TimeFilter,
  now: Date = new Date(),
): { from: Date | null; to: Date | null } {
  if (range) return { from: range.from, to: range.to };
  if (time === 'upcoming') return { from: now, to: null };
  if (time === 'past') return { from: null, to: now };
  return { from: null, to: null };
}

export async function runSearch(
  request: SearchRequest,
  role: Role | null,
  origin: string,
  now: Date = new Date(),
): Promise<SearchResult> {
  const parsed = parseQuery(request.query, now);
  const time = request.time ?? 'all';
  const { from, to } = effectiveRange(parsed.range, time, now);
  const kinds = request.kinds && request.kinds.length > 0 ? request.kinds : null;
  const limit = request.limit ?? 5;

  const hits: SearchHit[] = [];

  // Seiten nur ohne Zeitangabe: „Samstag" meint einen Termin, keine Seite.
  if (!parsed.range && time === 'all' && (!kinds || kinds.includes('page'))) {
    for (const { page, score } of searchPages(parsed.text, role, limit)) {
      hits.push({
        kind: 'page',
        id: page.id,
        title: page.label,
        subtitle: page.hint,
        startsAt: null,
        target: page.to,
        external: false,
        score: score * KINDS.page.weight,
        mine: false,
        myStatus: null,
        canManage: false,
        meta: {},
      });
    }
  }

  const serverKinds = kinds?.filter((kind) => kind !== 'page') ?? null;
  const hasText = searchable(parsed.text);
  // Ein reiner Zeitfilter ohne Text wäre „alles Kommende" — das ist der Kalender, keine Suche.
  const askServer = (hasText || parsed.range !== null) && (serverKinds === null || serverKinds.length > 0);

  if (askServer) {
    const { data, error } = await supabase.rpc('rpc_search', {
      p_query: parsed.text,
      p_kinds: serverKinds,
      p_from: from?.toISOString() ?? null,
      p_to: to?.toISOString() ?? null,
      p_limit: limit,
    });
    if (error) throw error;
    for (const row of (data ?? []) as unknown as RpcRow[]) hits.push(toHit(row, origin));
  }

  return { hits: sortHits(hits), range: parsed.range, offline: false };
}

/** Beste Treffer zuerst; bei Gleichstand Kommendes nach Datum, sonst alphabetisch. */
export function sortHits(hits: SearchHit[]): SearchHit[] {
  return [...hits].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.startsAt && b.startsAt) return a.startsAt.localeCompare(b.startsAt);
    return a.title.localeCompare(b.title, 'de');
  });
}

export interface HitGroup {
  kind: SearchKind;
  hits: SearchHit[];
}

/** Gruppiert nach Art; die Gruppe mit dem besten Treffer steht oben. */
export function groupHits(hits: SearchHit[]): HitGroup[] {
  const groups = new Map<SearchKind, SearchHit[]>();
  for (const hit of sortHits(hits)) {
    groups.set(hit.kind, [...(groups.get(hit.kind) ?? []), hit]);
  }
  return [...groups.entries()].map(([kind, list]) => ({ kind, hits: list }));
}

// ---------------------------------------------------------------- offline

function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /fetch|network|load failed/i.test(message);
}

function rowsOf(client: QueryClient, key: readonly unknown[]): Record<string, unknown>[] {
  const data = client.getQueryData<unknown>(key);
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

/**
 * Ohne Netz: Suche im gespeicherten Stand (docs/suche.md, 2.2 Punkt 11). Nur was ohnehin
 * auf dem Gerät liegt — das Verzeichnis, die Mannschaften und die Termine aus dem
 * Kalender. Alles davon hat die Datenbank dem Mitglied schon einmal gegeben; neue Rechte
 * entstehen hier nicht.
 */
export function searchOffline(
  client: QueryClient,
  request: SearchRequest,
  role: Role | null,
  now: Date = new Date(),
): SearchResult {
  const parsed = parseQuery(request.query, now);
  const { from, to } = effectiveRange(parsed.range, request.time ?? 'all', now);
  const kinds = request.kinds && request.kinds.length > 0 ? request.kinds : null;
  const wants = (kind: SearchKind) => !kinds || kinds.includes(kind);
  const tokens = searchTokens(parsed.text);
  const limit = request.limit ?? 5;
  const hits: SearchHit[] = [];

  const base = {
    subtitle: null,
    startsAt: null,
    external: false,
    mine: false,
    myStatus: null,
    canManage: false,
    meta: {},
  };

  if (!parsed.range && wants('page')) {
    for (const { page, score } of searchPages(parsed.text, role, limit)) {
      hits.push({ ...base, kind: 'page', id: page.id, title: page.label, subtitle: page.hint, target: page.to, score });
    }
  }

  if (!parsed.range && tokens.length > 0 && wants('member')) {
    rowsOf(client, queryKeys.members.directory())
      .filter((row) => matchesSearch([row.full_name as string], parsed.text))
      .slice(0, limit)
      .forEach((row) =>
        hits.push({
          ...base,
          kind: 'member',
          id: String(row.id),
          title: String(row.full_name ?? ''),
          target: `/my-club?tab=members&q=${encodeURIComponent(String(row.full_name ?? ''))}`,
          score: 0.8,
        }),
      );
  }

  if (!parsed.range && tokens.length > 0 && wants('team')) {
    rowsOf(client, queryKeys.teams.list())
      .filter((row) => matchesSearch([row.name as string], parsed.text))
      .slice(0, limit)
      .forEach((row) =>
        hits.push({
          ...base,
          kind: 'team',
          id: String(row.id),
          title: String(row.name ?? ''),
          target: '/my-club?tab=teams',
          score: 0.75,
        }),
      );
  }

  const calendarKinds: Record<string, SearchKind> = {
    match: 'match',
    training: 'session',
    event: 'event',
  };
  if (tokens.length > 0 || parsed.range) {
    rowsOf(client, queryKeys.calendar.items())
      .filter((row) => {
        const kind = calendarKinds[String(row.kind)];
        if (!kind || !wants(kind)) return false;
        const at = row.starts_at ? new Date(String(row.starts_at)) : null;
        if (from && (!at || at < from)) return false;
        if (to && (!at || at >= to)) return false;
        return tokens.length === 0 || matchesSearch([row.title as string], parsed.text);
      })
      .slice(0, limit * 3)
      .forEach((row) => {
        const kind = calendarKinds[String(row.kind)];
        const path = kind === 'match' ? 'match' : kind === 'session' ? 'training' : 'event';
        hits.push({
          ...base,
          kind,
          id: String(row.id),
          title: String(row.title ?? ''),
          startsAt: row.starts_at ? String(row.starts_at) : null,
          target: `/${path}/${String(row.id)}`,
          mine: row.mine === true,
          score: 0.7,
        });
      });
  }

  return { hits: sortHits(hits), range: parsed.range, offline: true };
}

// ---------------------------------------------------------------- Hook

export function useDebounced<T>(value: T, delay = DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Die Suche als Query. Nicht im Offline-Speicher (`queryPersist` lässt `search` aus):
 * Suchbegriffe sind personenbezogen und gehören nicht auf die Platte.
 */
export function useSearch(request: SearchRequest, role: Role | null, enabled = true) {
  const client = useQueryClient();
  const query = request.query.trim();
  const active = enabled && query.length > 0;

  return useQuery({
    queryKey: queryKeys.search(query, request.kinds ?? [], request.time ?? 'all', request.limit ?? 5),
    enabled: active,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: false,
    placeholderData: (previous) => previous,
    queryFn: async (): Promise<SearchResult> => {
      const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return searchOffline(client, request, role);
      }
      try {
        return await runSearch(request, role, origin);
      } catch (error) {
        if (isNetworkError(error)) return searchOffline(client, request, role);
        throw error;
      }
    },
  });
}
