import type { Enums } from './database.types';

/**
 * Deutsche Beschriftungen für alle Enum-Werte der Datenbank.
 *
 * Genau eine Stelle für die Übersetzung: die Datenbank spricht englisch, die Oberfläche
 * deutsch. Wer einen Enum-Wert ergänzt, ergänzt ihn hier — der Test in
 * tests/lib/labels.test.ts läuft sonst rot.
 */

export const ROLE_LABELS: Record<Enums<'user_role'>, string> = {
  admin: 'Admin',
  team_leader: 'Mannschaftsführer',
  trainer: 'Trainer',
  organizer: 'Organisator',
  member: 'Mitglied',
  guest: 'Gast',
};

export const STATUS_LABELS: Record<Enums<'member_status'>, string> = {
  active: 'aktiv',
  pending_approval: 'nicht freigeschaltet',
  unconfirmed: 'unbestätigt',
};

export const GENDER_LABELS: Record<Enums<'gender'>, string> = {
  male: 'männlich',
  female: 'weiblich',
  unspecified: 'keine Angabe',
};

export const RANKING_TYPE_LABELS: Record<Enums<'ranking_type'>, string> = {
  men: 'Erwachsene',
  women: 'Damen',
  seniors_40: 'Senioren 40',
  seniors_50: 'Senioren 50',
  seniors_60: 'Senioren 60',
  seniors_70: 'Senioren 70',
  seniors_75: 'Senioren 75',
  youth_19: 'Jugend 19',
  youth_15: 'Jugend 15',
  youth_13: 'Jugend 13',
  youth_11: 'Jugend 11',
  girls_19: 'Mädchen 19',
  girls_15: 'Mädchen 15',
  girls_13: 'Mädchen 13',
  girls_11: 'Mädchen 11',
};

export function roleLabel(role: Enums<'user_role'> | null | undefined): string {
  return role ? ROLE_LABELS[role] : '';
}

export function statusLabel(status: Enums<'member_status'> | null | undefined): string {
  return status ? STATUS_LABELS[status] : '';
}

export function rankingTypeLabel(type: Enums<'ranking_type'> | null | undefined): string {
  return type ? RANKING_TYPE_LABELS[type] : '';
}

/** Rang als „1.2" aus Mannschafts- und Positionsnummer. */
export function formatRanking(teamNumber: number, positionNumber: number): string {
  return `${teamNumber}.${positionNumber}`;
}

/** Gegenstück zu formatRanking: „1.2" → { teamNumber: 1, positionNumber: 2 }. */
export function parseRanking(
  value: string,
): { teamNumber: number; positionNumber: number } | null {
  const match = /^\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*$/.exec(value);
  if (!match) return null;
  return { teamNumber: Number(match[1]), positionNumber: Number(match[2]) };
}
