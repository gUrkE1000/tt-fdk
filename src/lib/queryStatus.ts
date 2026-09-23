/** Was von einer react-query-Abfrage für die Anzeige zählt. */
export interface QueryLike {
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}

export interface QueryStatus {
  /** Mindestens eine Abfrage lädt zum ersten Mal (noch keine Daten). */
  loading: boolean;
  /** Mindestens eine Abfrage ist gescheitert. */
  error: boolean;
  /** Lädt die gescheiterten Abfragen neu. */
  retry: () => void;
}

/**
 * Fasst mehrere Abfragen zu einem Zustand zusammen.
 *
 * Eine Liste, die aus drei Abfragen zusammengesetzt wird, ist leer, sobald eine davon
 * fehlt. Ob das „noch nicht da", „gescheitert" oder „wirklich leer" heißt, entscheidet
 * sich hier — damit der Leerzustand nur noch bei echter Leere erscheint.
 */
export function queryStatus(...queries: QueryLike[]): QueryStatus {
  return {
    loading: queries.some((query) => query.isLoading),
    error: queries.some((query) => query.isError),
    retry: () => {
      for (const query of queries) {
        if (query.isError) void query.refetch();
      }
    },
  };
}
