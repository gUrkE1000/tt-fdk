/**
 * Zentrale Schlüssel für react-query.
 *
 * Alle an einem Ort, weil das Ungültigmachen sonst rät: wer `members.list()` invalidiert,
 * trifft damit garantiert jede Mitgliederliste, egal welcher Filter gerade aktiv ist.
 * Verstreute String-Arrays führen früher oder später zu Listen, die nach dem Speichern
 * veraltet stehen bleiben.
 */

export const queryKeys = {
  publicClubInfo: ['public-club-info'] as const,

  profile: (userId: string | null) => ['profile', userId] as const,

  members: {
    all: ['members'] as const,
    list: (filters?: unknown) => ['members', 'list', filters ?? null] as const,
    adminList: (filters?: unknown) => ['members', 'admin-list', filters ?? null] as const,
    detail: (id: string) => ['members', 'detail', id] as const,
    directory: () => ['members', 'directory'] as const,
    rankings: () => ['members', 'rankings'] as const,
  },

  groups: {
    all: ['groups'] as const,
    list: () => ['groups', 'list'] as const,
  },

  venues: {
    all: ['venues'] as const,
    list: () => ['venues', 'list'] as const,
  },

  teams: {
    all: ['teams'] as const,
    list: () => ['teams', 'list'] as const,
    detail: (id: string) => ['teams', 'detail', id] as const,
  },

  matches: {
    all: ['matches'] as const,
    list: (filters?: unknown) => ['matches', 'list', filters ?? null] as const,
    detail: (id: string) => ['matches', 'detail', id] as const,
    participations: (matchId: string) => ['matches', 'participations', matchId] as const,
    mine: () => ['matches', 'mine'] as const,
  },

  trainings: {
    all: ['trainings'] as const,
    list: () => ['trainings', 'list'] as const,
    cancellations: () => ['trainings', 'cancellations'] as const,
    sessions: () => ['trainings', 'sessions'] as const,
    attendance: () => ['trainings', 'attendance'] as const,
    autoAttendance: (profileId: string) => ['trainings', 'auto-attendance', profileId] as const,
  },

  events: {
    all: ['events'] as const,
    list: () => ['events', 'list'] as const,
    participants: () => ['events', 'participants'] as const,
  },

  polls: {
    all: ['polls'] as const,
    list: () => ['polls', 'list'] as const,
    results: () => ['polls', 'results'] as const,
    voters: () => ['polls', 'voters'] as const,
  },

  calendar: {
    all: ['calendar'] as const,
    items: () => ['calendar', 'items'] as const,
    mine: (profileId: string | null) => ['calendar', 'mine', profileId] as const,
  },

  /**
   * „Offen für dich": alles, wo die eigene Antwort fehlt. Jede Rückmeldung
   * (Spiel, Training, Termin, Umfrage, Ersatzanfrage) macht diesen Schlüssel
   * ungültig — sonst stünde das Beantwortete weiter in der Liste.
   */
  open: {
    all: ['open'] as const,
    mine: (profileId: string | null) => ['open', profileId] as const,
  },

  notifications: {
    all: ['notifications'] as const,
    mine: (profileId: string | null) => ['notifications', 'mine', profileId] as const,
  },

  clubSettings: ['club-settings'] as const,
} as const;
