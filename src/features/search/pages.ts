import { NAV, visibleNav, type Role } from '../../app/nav';
import { normalizeSearch, searchable, searchTokens } from '../../lib/search';

/**
 * Seiten und Aktionen als Suchtreffer (docs/suche.md, 2.3).
 *
 * Mitglieder suchen in ihren Worten, nicht in unseren Menünamen: „Urlaub" meint
 * „Abwesenheit eintragen", „ICS" meint „Kalender abonnieren". Welche Seiten jemand
 * findet, entscheidet dieselbe Rollenliste wie das Menü (`nav.ts`) — eine Seite, die im
 * Menü fehlt, fehlt auch hier.
 */

export interface PageEntry {
  id: string;
  label: string;
  /** Wo es liegt, für die zweite Zeile: „Mein Profil". */
  hint: string;
  to: string;
  keywords: string[];
  /** Leer = für alle angemeldeten Rollen. */
  roles: Role[];
}

/** Zusätzliche Suchwörter je Menüpunkt. */
const NAV_KEYWORDS: Record<string, string[]> = {
  '/': ['start', 'startseite', 'dashboard', 'offen', 'offen für dich', 'home'],
  '/my-games': ['spiele', 'zusage', 'absage', 'rückmeldung', 'zusagen', 'absagen'],
  '/my-dates': ['termine', 'zugesagt', 'abgesagt'],
  '/notifications': ['nachrichten', 'posteingang', 'verlauf', 'benachrichtigungen'],
  '/my-club': [
    'verein',
    'mein verein',
    'mitgliederliste',
    'kontakte',
    'telefonliste',
    'ansprechpartner',
    'vereinsdaten',
    'ämter',
    'einstellungen',
    'betrieb',
    'protokoll',
    'sync',
  ],
  '/statistics': ['statistik', 'trainingsbeteiligung', 'anwesenheit', 'beteiligung'],
  '/trainings': ['training', 'ausfall', 'trainingsplanung'],
  '/teams': ['mannschaft', 'kader', 'stammspieler', 'ersatzspieler', 'rangliste'],
  '/games': ['spielplan', 'import', 'click tt', 'clicktt', 'spielverlegung', 'verlegung'],
  '/dates': ['veranstaltung', 'fest', 'feier', 'termin anlegen'],
  '/calendar': ['planung', 'monat', 'woche', 'abwesenheiten', 'geburtstage'],
  '/votes': ['umfrage', 'abstimmung', 'abstimmen', 'votes'],
  '/players': ['mitglieder verwalten', 'freischalten', 'rollen', 'gruppen', 'qttr'],
  '/venues': ['orte', 'halle', 'hallen', 'schlüssel', 'aufschließen', 'adresse'],
};

const ACTIONS: PageEntry[] = [
  {
    id: 'absence',
    label: 'Abwesenheit eintragen',
    hint: 'Mein Profil',
    to: '/profile?tab=absences',
    keywords: ['urlaub', 'verreist', 'nicht da', 'krank', 'abwesend', 'ferien', 'abwesenheit'],
    roles: [],
  },
  {
    id: 'notification-settings',
    label: 'Benachrichtigungen einstellen',
    hint: 'Mein Profil',
    to: '/profile?tab=notifications',
    keywords: ['push', 'mail', 'e-mail', 'erinnerung', 'glocke', 'benachrichtigung', 'eltern'],
    roles: [],
  },
  {
    id: 'calendar-subscribe',
    label: 'Kalender abonnieren',
    hint: 'Meine Termine',
    to: '/my-dates?subscribe=1',
    keywords: ['ics', 'abo', 'abonnieren', 'outlook', 'google kalender', 'iphone kalender', 'handy'],
    roles: [],
  },
  {
    id: 'profile',
    label: 'Mein Profil',
    hint: 'Profil',
    to: '/profile',
    keywords: ['profil', 'passwort', 'telefonnummer', 'kontakt freigeben', 'name ändern'],
    roles: [],
  },
  {
    id: 'privacy',
    label: 'Datenschutz, Datenexport, Konto löschen',
    hint: 'Mein Profil',
    to: '/profile',
    keywords: ['datenschutz', 'dsgvo', 'export', 'konto löschen', 'abmelden', 'daten herunterladen'],
    roles: [],
  },
  {
    id: 'app',
    label: 'App installieren',
    hint: 'Auf dem Handy',
    to: '/mobile-app',
    keywords: ['app', 'installieren', 'homescreen', 'startbildschirm', 'iphone', 'android'],
    roles: [],
  },
  {
    id: 'lineup',
    label: 'Spieler anfragen und aufstellen',
    hint: 'Spieltermine',
    to: '/games',
    keywords: ['aufstellung', 'ersatz', 'spieler anfragen', 'aufstellung teilen', 'whatsapp'],
    roles: ['admin', 'team_leader'],
  },
  {
    id: 'nuscore',
    label: 'Codes & PINs für nuScore',
    hint: 'Spieltermine',
    to: '/games',
    keywords: ['code', 'pin', 'nuscore', 'spielbericht'],
    roles: ['admin', 'team_leader'],
  },
  {
    id: 'hall-closure',
    label: 'Hallensperrung eintragen',
    hint: 'Hallensperrungen',
    to: '/hall-closures',
    keywords: ['ausfall', 'training absagen', 'fällt aus', 'hallensperrung', 'halle gesperrt'],
    roles: ['admin'],
  },
  {
    id: 'invite',
    label: 'Mitglied einladen',
    hint: 'Mitglieder',
    to: '/players',
    keywords: ['einladen', 'einladung', 'neues mitglied', 'registrierung', 'qr code', 'excel'],
    roles: ['admin'],
  },
  {
    id: 'news-write',
    label: 'Neuigkeit schreiben',
    hint: 'Verein',
    to: '/my-club?tab=news',
    keywords: ['neuigkeit', 'news', 'schwarzes brett', 'ankündigung'],
    roles: ['admin', 'organizer'],
  },
];

export function allPages(): PageEntry[] {
  const fromNav = NAV.flatMap((section) =>
    section.items.map(
      (item): PageEntry => ({
        id: `nav:${item.to}`,
        label: item.label,
        hint: section.section ?? 'Menü',
        to: item.to,
        keywords: NAV_KEYWORDS[item.to] ?? [],
        roles: item.roles,
      }),
    ),
  );
  return [...fromNav, ...ACTIONS];
}

/** Was diese Rolle überhaupt finden darf: nur Seiten, die ihr Menü auch zeigt. */
export function pagesForRole(role: Role | null | undefined): PageEntry[] {
  if (!role) return [];
  const visible = new Set(visibleNav(role).flatMap((section) => section.items.map((i) => i.to)));
  return allPages().filter((page) =>
    page.id.startsWith('nav:')
      ? visible.has(page.to)
      : page.roles.length === 0 || page.roles.includes(role),
  );
}

export interface PageHit {
  page: PageEntry;
  score: number;
}

/**
 * Bewertung wie in der Datenbank, nur einfacher: Jedes Suchwort muss Wortanfang in
 * Bezeichnung oder Stichwort sein. Treffer in der Bezeichnung zählen mehr.
 */
export function searchPages(
  query: string,
  role: Role | null | undefined,
  limit = 5,
): PageHit[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0 || !searchable(query)) return [];

  const hits: PageHit[] = [];
  for (const page of pagesForRole(role)) {
    const label = ` ${normalizeSearch(page.label)} `;
    const keywords = ` ${normalizeSearch(page.keywords.join(' '))} `;
    let score = 0;
    let ok = true;
    for (const token of tokens) {
      // Wie in der Datenbank: ganzes Wort vor Wortanfang vor Stichwort. Ein ganzes Wort
      // im Menünamen („kalender") schlägt jeden Datensatz, ein bloßer Wortanfang
      // („training" in „Trainingszusagen") nicht das Training selbst.
      if (label.includes(` ${token} `)) score += 1.1;
      else if (label.includes(` ${token}`)) score += 0.8;
      else if (keywords.includes(` ${token}`)) score += 0.6;
      else {
        ok = false;
        break;
      }
    }
    if (ok) hits.push({ page, score: score / tokens.length });
  }

  return hits
    .sort((a, b) => b.score - a.score || a.page.label.localeCompare(b.page.label, 'de'))
    .slice(0, limit);
}
