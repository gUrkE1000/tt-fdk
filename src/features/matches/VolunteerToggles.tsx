import { Car, Navigation } from 'lucide-react';
import { useToast } from '../../components/ui';
import { cn } from '../../lib/cn';
import { getShortName } from '../../lib/names';
import { useToggleVolunteer, type Volunteer } from './api';

export interface VolunteerTogglesProps {
  matchId: string;
  profileId: string;
  volunteers: Volunteer[];
  /** Name zu einer Profil-ID; angezeigt wird Vorname und Nachnamen-Initiale. */
  nameOf?: (profileId: string) => string;
  /** „Ich fahre direkt" gibt es nur bei Auswärtsspielen. */
  isHome?: boolean;
  /** Die Mannschaft kann den Fahrdienst ausblenden (Bestandsaufnahme C). */
  hidden?: boolean;
}

/**
 * Fahrdienst.
 *
 * Im TT-Planer sind das Selbstbedienungsknöpfe, keine Zuteilung durch den
 * Mannschaftsführer — und das ist richtig so: wer fahren kann, weiß es selbst am besten.
 *
 * „Ich fahre direkt" ist für die, die nah an der Auswärtshalle wohnen und nicht zum
 * Treffpunkt kommen. Es schließt „Ich kann fahren" aus — wer direkt fährt, nimmt am
 * Treffpunkt niemanden mit. Die Datenbank nimmt das jeweils andere zurück.
 * Die frühere Verpflegung („Ich bringe etwas mit") gibt es nicht mehr.
 */
export default function VolunteerToggles({
  matchId,
  profileId,
  volunteers,
  nameOf,
  isHome,
  hidden,
}: VolunteerTogglesProps) {
  const { toast } = useToast();
  const toggle = useToggleVolunteer();

  // Bei Heimspielen gibt es nichts zu fahren.
  if (hidden || isHome) return null;

  const mine = volunteers.filter((entry) => entry.profile_id === profileId);
  const isDriver = mine.some((entry) => entry.kind === 'driver');
  const isDirect = mine.some((entry) => entry.kind === 'direct');

  const drivers = volunteers.filter((entry) => entry.kind === 'driver');
  const direct = volunteers.filter((entry) => entry.kind === 'direct');

  // Namen, soweit bekannt; wer (noch) keinen hat, zählt als „weitere" — sonst stünde
  // die Zeile leer da, solange die Mitgliederliste lädt.
  function namesOf(entries: Volunteer[]): string {
    const names = entries
      .map((entry) => getShortName(nameOf?.(entry.profile_id) ?? ''))
      .filter(Boolean);
    const unnamed = entries.length - names.length;
    if (unnamed > 0) names.push(names.length > 0 ? `${unnamed} weitere` : String(unnamed));
    return names.join(', ');
  }

  async function flip(kind: 'driver' | 'direct', on: boolean) {
    try {
      await toggle.mutateAsync({ matchId, profileId, kind, on });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  const lines = [
    { label: 'Fahrer', entries: drivers },
    { label: 'Direkt zur Halle', entries: direct },
  ].filter((line) => line.entries.length > 0);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        <Toggle
          icon={Car}
          on={isDriver}
          onLabel="Kann doch nicht fahren"
          offLabel="Ich kann fahren"
          onClick={() => void flip('driver', !isDriver)}
        />
        <Toggle
          icon={Navigation}
          on={isDirect}
          onLabel="Fahre doch nicht direkt"
          offLabel="Ich fahre direkt"
          onClick={() => void flip('direct', !isDirect)}
        />
      </div>

      {lines.map(({ label, entries }) => (
        <p key={label} className="break-words text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{label}:</span> {namesOf(entries)}
        </p>
      ))}
    </div>
  );
}

function Toggle({
  icon: Icon,
  on,
  onLabel,
  offLabel,
  onClick,
}: {
  icon: typeof Car;
  on: boolean;
  onLabel: string;
  offLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-touch items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        on
          ? 'border-primary bg-primary-soft text-primary'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {on ? onLabel : offLabel}
    </button>
  );
}
