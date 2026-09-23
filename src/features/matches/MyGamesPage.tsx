import { useState } from 'react';
import { PageHeader } from '../../components/ui';
import { cn } from '../../lib/cn';
import { useMatches } from './api';
import { useTeams } from '../teams/api';
import MyGamesList, { type MyGamesScope } from './MyGamesList';
import SubstituteBanner from '../substitutes/SubstituteBanner';

const CHIPS: { value: MyGamesScope; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'home', label: 'Heim' },
  { value: 'away', label: 'Auswärts' },
  { value: 'past', label: 'Vergangene' },
];

/**
 * „Meine Spiele": alle kommenden Termine, an denen ich beteiligt bin — im Kader oder weil
 * mich jemand dazugeholt hat. Die vergangenen stehen hinter dem Chip „Vergangene": Die
 * Seite „Spieltermine" erreichen nur Mannschaftsführer und Administratoren.
 */
export default function MyGamesPage() {
  const matches = useMatches();
  const teams = useTeams();
  const [scope, setScope] = useState<MyGamesScope>('all');

  return (
    <div>
      <PageHeader
        title="Meine Spiele"
        description="Alles, wozu du dich zurückmelden solltest."
      />

      <SubstituteBanner
        describe={(request) => {
          const forMatch = (matches.data ?? []).find((entry) => entry.id === request.match_id);
          if (!forMatch) return 'Ein Spieltermin';
          const team = (teams.data ?? []).find((entry) => entry.id === forMatch.team_id);
          return `${team?.name ?? 'Mannschaft'} gegen ${forMatch.opponent || 'unbekannt'}`;
        }}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            aria-pressed={scope === chip.value}
            onClick={() => setScope(chip.value)}
            className={cn(
              'min-h-touch rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              scope === chip.value
                ? 'border-primary bg-primary text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <MyGamesList scope={scope} />
    </div>
  );
}
