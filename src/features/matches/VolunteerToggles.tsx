import { Car, ShoppingBasket } from 'lucide-react';
import { useToast } from '../../components/ui';
import { cn } from '../../lib/cn';
import { useToggleVolunteer, type Volunteer } from './api';

export interface VolunteerTogglesProps {
  matchId: string;
  profileId: string;
  volunteers: Volunteer[];
  /** Die Mannschaft kann beides ausblenden (Bestandsaufnahme C). */
  hidden?: boolean;
}

/**
 * Fahrdienst und Verpflegung.
 *
 * Im TT-Planer sind das zwei Selbstbedienungsknöpfe, keine Zuteilung durch den
 * Mannschaftsführer — und das ist richtig so: wer fahren kann, weiß es selbst am besten.
 */
export default function VolunteerToggles({
  matchId,
  profileId,
  volunteers,
  hidden,
}: VolunteerTogglesProps) {
  const { toast } = useToast();
  const toggle = useToggleVolunteer();

  if (hidden) return null;

  const mine = volunteers.filter((entry) => entry.profile_id === profileId);
  const isDriver = mine.some((entry) => entry.kind === 'driver');
  const isCatering = mine.some((entry) => entry.kind === 'catering');

  const drivers = volunteers.filter((entry) => entry.kind === 'driver');

  async function flip(kind: 'driver' | 'catering', on: boolean) {
    try {
      await toggle.mutateAsync({ matchId, profileId, kind, on });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

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
          icon={ShoppingBasket}
          on={isCatering}
          onLabel="Bringe doch nichts mit"
          offLabel="Ich bringe etwas mit"
          onClick={() => void flip('catering', !isCatering)}
        />
      </div>

      {drivers.length > 0 && (
        <p className="text-xs text-gray-500">
          {drivers.length === 1 ? '1 Fahrer' : `${drivers.length} Fahrer`} eingetragen
        </p>
      )}
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
