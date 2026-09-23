import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Swords,
  CalendarCheck,
  Building2,
  BarChart3,
  Dumbbell,
  Users,
  CalendarDays,
  PartyPopper,
  Calendar,
  Vote,
  UserCog,
  Settings,
  MapPin,
  Inbox,
} from 'lucide-react';

/**
 * Benutzerrollen. Entspricht dem Enum `user_role` in der Datenbank und den sechs Rollen
 * des TT-Planers (Zielbild 5).
 */
export type Role = 'admin' | 'team_leader' | 'trainer' | 'organizer' | 'member' | 'guest';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Leer = für alle angemeldeten Rollen sichtbar. */
  roles: Role[];
  /** Für die Bottom-Bar auf dem Smartphone. */
  primary?: boolean;
}

export interface NavSection {
  /** `null` = Einträge ohne Abschnittsüberschrift, ganz oben. */
  section: string | null;
  items: NavItem[];
}

/**
 * Navigationsstruktur nach Zielbild 2. Die Routen spiegeln bewusst den TT-Planer,
 * damit Mitglieder, die ihn kennen, nichts neu lernen müssen.
 */
export const NAV: NavSection[] = [
  {
    section: null,
    items: [
      { to: '/', label: 'Übersicht', icon: LayoutDashboard, roles: [], primary: true },
      { to: '/my-games', label: 'Meine Spiele', icon: Swords, roles: [], primary: true },
      { to: '/my-dates', label: 'Meine Termine', icon: CalendarCheck, roles: [] },
      { to: '/notifications', label: 'Mitteilungen', icon: Inbox, roles: [] },
    ],
  },
  {
    section: 'Verein',
    items: [
      { to: '/my-club', label: 'Mein Verein', icon: Building2, roles: [] },
      {
        // Für alle sichtbar, weil die Freigabe am Training hängt und nicht an der
        // Rolle (`statistics_visibility`): Ein Mitglied einer freigegebenen Gruppe
        // käme sonst nie auf die Seite. In der Voreinstellung („admins") sieht es
        // dort eine leere Seite mit Erklärung — eine Menüzeile ist der kleinere
        // Preis als ein Menüpunkt, den man nur über die Adresszeile erreicht.
        to: '/statistics',
        label: 'Statistiken',
        icon: BarChart3,
        roles: [],
      },
    ],
  },
  {
    section: 'Planen',
    items: [
      {
        to: '/trainings',
        label: 'Trainings',
        icon: Dumbbell,
        roles: ['admin', 'trainer'],
        primary: true,
      },
      { to: '/teams', label: 'Mannschaften', icon: Users, roles: ['admin', 'team_leader'] },
      {
        to: '/games',
        label: 'Spieltermine',
        icon: CalendarDays,
        roles: ['admin', 'team_leader'],
      },
      {
        to: '/dates',
        label: 'Vereinstermine',
        icon: PartyPopper,
        roles: ['admin', 'organizer'],
      },
      { to: '/calendar', label: 'Kalender', icon: Calendar, roles: [], primary: true },
      { to: '/votes', label: 'Umfragen', icon: Vote, roles: [] },
    ],
  },
  {
    section: 'Verwalten',
    items: [
      { to: '/players', label: 'Mitglieder', icon: UserCog, roles: ['admin'] },
      { to: '/club', label: 'Verein', icon: Settings, roles: ['admin'] },
      { to: '/venues', label: 'Orte & Schlüssel', icon: MapPin, roles: ['admin'] },
    ],
  },
];

/**
 * Filtert die Navigation auf das, was diese Rolle sehen darf.
 * Abschnitte ohne sichtbare Einträge fallen weg.
 */
export function visibleNav(role: Role | null | undefined): NavSection[] {
  if (!role) return [];

  return NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.length === 0 || item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}

/** Die Einträge für die Bottom-Bar auf dem Smartphone, in der Reihenfolge der Navigation. */
export function primaryNav(role: Role | null | undefined): NavItem[] {
  return visibleNav(role)
    .flatMap((section) => section.items)
    .filter((item) => item.primary);
}

/** Beschriftung einer Route für die Kopfzeile. */
export function labelForPath(pathname: string): string {
  const exact = NAV.flatMap((s) => s.items).find((item) => item.to === pathname);
  if (exact) return exact.label;

  const prefix = NAV.flatMap((s) => s.items)
    .filter((item) => item.to !== '/' && pathname.startsWith(item.to))
    .sort((a, b) => b.to.length - a.to.length)[0];

  return prefix?.label ?? 'Vereinsplaner';
}
