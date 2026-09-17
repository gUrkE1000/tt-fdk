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
    detail: (id: string) => ['members', 'detail', id] as const,
    directory: () => ['members', 'directory'] as const,
  },

  groups: {
    all: ['groups'] as const,
    list: () => ['groups', 'list'] as const,
  },

  venues: {
    all: ['venues'] as const,
    list: () => ['venues', 'list'] as const,
  },

  clubSettings: ['club-settings'] as const,
} as const;
