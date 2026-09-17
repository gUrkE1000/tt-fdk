import { RANKING_TYPE_LABELS } from '../../lib/labels';
import { FormField, Input } from '../../components/ui';
import type { RankingType } from './api';

const TYPES = Object.keys(RANKING_TYPE_LABELS) as RankingType[];

export interface RankingEditorProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  error?: string;
}

/**
 * Die 15 Altersklassen des TT-Planers, je ein Feld im Format „1.2" (Mannschaft.Position).
 *
 * Bewusst als Text und nicht als zwei Zahlenfelder: wer die Liste aus dem Verband
 * abschreibt, liest dort „1.2" und tippt „1.2". Die Zerlegung passiert beim Speichern.
 */
export default function RankingEditor({ value, onChange, error }: RankingEditorProps) {
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-3">
        {TYPES.map((type) => (
          <FormField key={type} label={RANKING_TYPE_LABELS[type]}>
            {(p) => (
              <Input
                {...p}
                value={value[type] ?? ''}
                onChange={(event) => onChange({ ...value, [type]: event.target.value })}
                placeholder="1.2"
                inputMode="decimal"
              />
            )}
          </FormField>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
