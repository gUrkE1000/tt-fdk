import { Navigate, useSearchParams } from 'react-router-dom';

/** Frühere Reiter von „Verein" (`/club`) und wo sie heute stehen. */
const TABS: Record<string, string> = {
  data: 'data',
  offices: 'contacts',
  news: 'news',
  files: 'files',
  overview: 'overview',
  operations: 'operations',
};

/**
 * „Verein" und „Mein Verein" sind eine Seite (`/my-club`). Alte Links und Lesezeichen
 * auf `/club` landen im passenden Reiter.
 */
export default function ClubPage() {
  const [search] = useSearchParams();
  const tab = TABS[search.get('tab') ?? ''] ?? 'data';
  return <Navigate to={`/my-club?tab=${tab}`} replace />;
}
