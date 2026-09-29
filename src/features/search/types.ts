import {
  Inbox,
  MapPin,
  MessageSquare,
  Newspaper,
  PartyPopper,
  User,
  Users,
  Vote,
  Compass,
  BadgeCheck,
  type LucideIcon,
} from 'lucide-react';
import TableTennis from '../../components/icons/TableTennis';
import Podium from '../../components/icons/Podium';
import type { Role } from '../../app/nav';

/** Arten von Treffern. `page` kommt aus dem Browser, alle anderen aus `rpc_search`. */
export type SearchKind =
  | 'page'
  | 'member'
  | 'team'
  | 'match'
  | 'training'
  | 'session'
  | 'event'
  | 'poll'
  | 'news'
  | 'venue'
  | 'office'
  | 'message'
  | 'notification';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  startsAt: string | null;
  /** Ziel innerhalb der App, oder eine externe Adresse (Kartenlink). */
  target: string;
  external: boolean;
  score: number;
  mine: boolean;
  myStatus: string | null;
  canManage: boolean;
  meta: Record<string, unknown>;
}

export interface KindInfo {
  /** Überschrift der Gruppe. */
  label: string;
  /** Beschriftung des Filterchips auf der Ergebnisseite. */
  chip: string;
  icon: LucideIcon;
  /** Gewicht beim Mischen der Gruppen (docs/suche.md, 5.2). */
  weight: number;
  /**
   * Rollen, für die die Art überhaupt Treffer haben kann — nur für die Filterchips.
   * Die Grenze zieht die Datenbank; ein Chip ohne mögliche Treffer wäre nur verwirrend.
   */
  roles?: Role[];
}

const PLAYING: Role[] = ['admin', 'team_leader', 'trainer', 'organizer', 'member'];

export const KINDS: Record<SearchKind, KindInfo> = {
  page: { label: 'Seiten & Aktionen', chip: 'Seiten', icon: Compass, weight: 1 },
  member: { label: 'Mitglieder', chip: 'Personen', icon: User, weight: 1 },
  match: { label: 'Spiele', chip: 'Spiele', icon: Podium, weight: 1, roles: PLAYING },
  team: { label: 'Mannschaften', chip: 'Mannschaften', icon: Users, weight: 0.95, roles: PLAYING },
  training: { label: 'Trainings', chip: 'Trainings', icon: TableTennis, weight: 0.95 },
  session: { label: 'Trainingstermine', chip: 'Trainingstermine', icon: TableTennis, weight: 0.95 },
  event: { label: 'Vereinstermine', chip: 'Vereinstermine', icon: PartyPopper, weight: 0.95 },
  poll: { label: 'Umfragen', chip: 'Umfragen', icon: Vote, weight: 0.9 },
  news: { label: 'Neuigkeiten', chip: 'Neuigkeiten', icon: Newspaper, weight: 0.9 },
  // Wer nach einem Amt sucht („kasse", „jugendwart"), meint das Amt, nicht die Person.
  office: { label: 'Ämter', chip: 'Ämter', icon: BadgeCheck, weight: 1.05 },
  venue: { label: 'Orte', chip: 'Orte', icon: MapPin, weight: 0.85 },
  message: { label: 'Nachrichten am Termin', chip: 'Nachrichten', icon: MessageSquare, weight: 0.8 },
  notification: { label: 'Meine Mitteilungen', chip: 'Mitteilungen', icon: Inbox, weight: 0.8 },
};

/** Reihenfolge der Filterchips. */
export const KIND_ORDER: SearchKind[] = [
  'page',
  'member',
  'match',
  'team',
  'training',
  'session',
  'event',
  'poll',
  'news',
  'office',
  'venue',
  'message',
  'notification',
];

export function kindsForRole(role: Role | null | undefined): SearchKind[] {
  if (!role) return [];
  return KIND_ORDER.filter((kind) => !KINDS[kind].roles || KINDS[kind].roles!.includes(role));
}
