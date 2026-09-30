/**
 * Die Einzelansicht eines Spiels, Trainingstermins oder Vereinstermins als Blatt über
 * der Seite, auf der man gerade ist.
 *
 * Vorher waren das eigene Seiten (`/match/…`). Wer am Telefon vom Rand zurückwischte,
 * landete dort, wo er davor war — oft auf der Übersicht, mit der Liste wieder oben.
 * Jetzt steht die Einzelansicht als Parameter in der Adresse der Seite darunter
 * (`/my-games?match=…`): Zurückwischen nimmt nur den Parameter weg, das Blatt geht zu,
 * und die Seite darunter war nie weg — samt der Stelle, an die man gescrollt hatte.
 *
 * Die alten Adressen bleiben gültig: Sie stehen in E-Mails, Push-Nachrichten und im
 * Kalender-Abo. Wer über sie kommt, landet auf der passenden Liste, dort beim Termin,
 * und das Blatt liegt darüber (`DetailEntry`).
 */

export type DetailKind = 'match' | 'training' | 'event';

export interface Detail {
  kind: DetailKind;
  id: string;
}

/** Suchparameter je Art. Dieselben Wörter wie in den alten Pfaden. */
export const DETAIL_KINDS: readonly DetailKind[] = ['match', 'training', 'event'];

/**
 * Was im Verlauf an einem Eintrag hängt.
 *
 * - `detailSheet`: Dieser Eintrag wurde für das Blatt angelegt. Dann schließt das Blatt
 *   mit einem Schritt zurück — sonst bliebe ein Eintrag „vorwärts" übrig, und das
 *   nächste Zurückwischen öffnete das Blatt wieder.
 * - `focus`: Der Termin, zu dem die Liste darunter scrollen soll.
 */
export interface DetailState {
  detailSheet?: boolean;
  focus?: Detail;
}

export function isDetailKind(value: unknown): value is DetailKind {
  return typeof value === 'string' && (DETAIL_KINDS as readonly string[]).includes(value);
}

/** Welche Einzelansicht die Adresse gerade öffnet — höchstens eine. */
export function readDetail(search: string | URLSearchParams): Detail | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  for (const kind of DETAIL_KINDS) {
    const id = params.get(kind);
    if (id) return { kind, id };
  }
  return null;
}

/**
 * Die Suchparameter mit (oder ohne) Einzelansicht. Alles andere bleibt stehen — der
 * Reiter einer Seite etwa (`?tab=news&match=…`).
 */
export function withDetail(search: string, detail: Detail | null): string {
  const params = new URLSearchParams(search);
  for (const kind of DETAIL_KINDS) params.delete(kind);
  if (detail) params.set(detail.kind, detail.id);
  const text = params.toString();
  return text ? `?${text}` : '';
}

const PATH_PATTERN = /^\/(match|training|event)\/([^/?#]+)\/?$/;

/** Ist das die Adresse einer Einzelansicht (`/match/…`)? Dann welche. */
export function detailFromPath(path: string): Detail | null {
  const pathname = path.split(/[?#]/)[0];
  const found = PATH_PATTERN.exec(pathname);
  if (!found || !isDetailKind(found[1])) return null;
  return { kind: found[1], id: decodeURIComponent(found[2]) };
}

/**
 * Die Liste, zu der eine Einzelansicht gehört — dorthin führt das Zurückwischen, wenn
 * man über einen Link von außen kam. Dieselben Ziele wie die früheren „Zurück"-Links.
 */
export function parentOf(kind: DetailKind): { pathname: string; search: string } {
  switch (kind) {
    case 'match':
      return { pathname: '/my-games', search: '' };
    case 'training':
      return { pathname: '/my-club', search: '?tab=trainings' };
    case 'event':
      return { pathname: '/my-club', search: '?tab=events' };
  }
}

/** Beschriftung der Kopfzeile des Blatts. */
export function detailLabel(kind: DetailKind): string {
  switch (kind) {
    case 'match':
      return 'Spiel';
    case 'training':
      return 'Training';
    case 'event':
      return 'Vereinstermin';
  }
}

/**
 * Markierung an einer Karte in einer Liste, damit die Liste nach dem Schließen des
 * Blatts zu ihr scrollen kann: `data-detail="match:…"`.
 */
export function detailMarker(kind: DetailKind, id: string): string {
  return `${kind}:${id}`;
}
