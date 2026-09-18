import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  applyTheme,
  prefersDarkNow,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  THEME_LABELS,
  type ThemeChoice,
} from '../../lib/theme';

const CHOICES: { value: ThemeChoice; icon: typeof Sun }[] = [
  { value: 'system', icon: Monitor },
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
];

/**
 * Der Umschalter im Profil (Aufgabe 9.11).
 *
 * Die Wahl liegt in `localStorage` und nicht im Profil: Sie gehört zum Gerät, nicht zur
 * Person. Wer abends auf dem Handy dunkel liest und tagsüber am Rechner hell arbeitet,
 * soll das nicht bei jedem Wechsel neu einstellen müssen.
 */
export default function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(resolveTheme(choice, prefersDarkNow()), document.documentElement);

    if (choice !== 'system') return;

    // Bei „wie das System" auf den Wechsel horchen — sonst bliebe die Anwendung hell,
    // wenn das Gerät abends umschaltet.
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;

    const onChange = (event: MediaQueryListEvent) =>
      applyTheme(event.matches ? 'dark' : 'light', document.documentElement);

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [choice]);

  return (
    <div role="radiogroup" aria-label="Darstellung" className="flex flex-wrap gap-1.5">
      {CHOICES.map((entry) => {
        const Icon = entry.icon;
        const active = choice === entry.value;

        return (
          <button
            key={entry.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              setChoice(entry.value);
              storeTheme(entry.value);
            }}
            className={cn(
              'inline-flex min-h-touch items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              active
                ? 'border-primary bg-primary text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {THEME_LABELS[entry.value]}
          </button>
        );
      })}
    </div>
  );
}
