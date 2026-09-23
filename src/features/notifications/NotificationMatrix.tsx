import { Checkbox } from '../../components/ui';
import type { PreferenceRow } from './api';

export interface NotificationMatrixProps {
  rows: PreferenceRow[];
  draft: Record<string, { email: boolean; push: boolean }>;
  onChange: (type: string, next: { email: boolean; push: boolean }) => void;
  /** Eine ganze Spalte auf einmal an- oder abschalten. */
  onChangeAll?: (channel: 'push' | 'email', value: boolean) => void;
}

/**
 * Fünfzehn Ereignistypen mal zwei Kanäle.
 *
 * Auf dem Smartphone ist eine Tabelle mit zwei Spalten Kästchen unbedienbar, deshalb
 * unterhalb von 640 px eine Liste mit zwei Schaltern je Zeile. Dieselben Daten, andere
 * Form — nicht weniger Funktion.
 */
export default function NotificationMatrix({
  rows,
  draft,
  onChange,
  onChangeAll,
}: NotificationMatrixProps) {
  const states = rows.map((row) => draft[row.type!] ?? { email: true, push: true });
  const allPush = states.length > 0 && states.every((state) => state.push);
  const allEmail = states.length > 0 && states.every((state) => state.email);

  return (
    <div>
      {/* Siebzehn Zeilen einzeln anzuklicken ist niemandem zuzumuten, der nur „alles per
          App, nichts per E-Mail" will. */}
      {onChangeAll && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChangeAll('push', !allPush)}
            className="min-h-touch rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {allPush ? 'Alle App-Hinweise aus' : 'Alle App-Hinweise an'}
          </button>
          <button
            type="button"
            onClick={() => onChangeAll('email', !allEmail)}
            className="min-h-touch rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {allEmail ? 'Alle E-Mails aus' : 'Alle E-Mails an'}
          </button>
        </div>
      )}

      {/* Ab sm: echte Tabelle mit Spaltenköpfen. */}
      <table className="hidden w-full border-collapse text-sm sm:table">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th className="py-2 pr-3 font-semibold text-gray-600">Ereignis</th>
            <th className="w-20 py-2 text-center font-semibold text-gray-600">App</th>
            <th className="w-20 py-2 text-center font-semibold text-gray-600">E-Mail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const state = draft[row.type!] ?? { email: true, push: true };
            return (
              <tr key={row.type} className="border-b border-gray-100">
                <td className="py-2 pr-3 text-gray-800">{row.label}</td>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    aria-label={`${row.label} in der App`}
                    checked={state.push}
                    onChange={(event) =>
                      onChange(row.type!, { ...state, push: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </td>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    aria-label={`${row.label} per E-Mail`}
                    checked={state.email}
                    onChange={(event) =>
                      onChange(row.type!, { ...state, email: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Unter sm: je Ereignis ein Block mit zwei Schaltern. */}
      <ul className="space-y-3 sm:hidden">
        {rows.map((row) => {
          const state = draft[row.type!] ?? { email: true, push: true };
          return (
            <li key={row.type} className="rounded-xl border border-gray-200 p-3">
              <p className="mb-1.5 font-semibold text-gray-900">{row.label}</p>
              <div className="space-y-1">
                <Checkbox
                  checked={state.push}
                  onCheckedChange={(value) => onChange(row.type!, { ...state, push: value })}
                  label="In der App"
                />
                <Checkbox
                  checked={state.email}
                  onCheckedChange={(value) => onChange(row.type!, { ...state, email: value })}
                  label="Per E-Mail"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
