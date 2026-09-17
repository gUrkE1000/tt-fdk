import { useMemo, useState } from 'react';
import { Button, Dialog, FormField, Textarea, useToast } from '../../components/ui';
import { useBulkUpdateQttr, type Member } from './api';
import { matchQttrLines, parseQttrLines } from './schemas';

export interface QttrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
}

/**
 * Vor jeder Saison kommt eine Liste „Name → QTTR". Statt dreißig Mitglieder einzeln zu
 * öffnen, wird sie hier eingefügt. Der Dialog zeigt vor dem Speichern, welche Zeilen
 * zugeordnet werden konnten — sonst verschwänden Tippfehler stillschweigend.
 */
export default function QttrDialog({ open, onOpenChange, members }: QttrDialogProps) {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const bulkUpdate = useBulkUpdateQttr();

  const preview = useMemo(() => {
    const { lines, invalid } = parseQttrLines(input);
    const { matched, unmatched } = matchQttrLines(lines, members);
    return { matched, unmatched, invalid };
  }, [input, members]);

  async function onSave() {
    try {
      const count = await bulkUpdate.mutateAsync(
        preview.matched.map((entry) => ({ id: entry.id, qttr: entry.qttr })),
      );
      toast(`${count} QTTR-Werte aktualisiert`, 'success');
      setInput('');
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="QTTR-Werte aktualisieren"
      description="Liste einfügen — je Zeile ein Name und der Wert."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button
            variant="primary"
            disabled={preview.matched.length === 0}
            loading={bulkUpdate.isPending}
            onClick={() => void onSave()}
          >
            {preview.matched.length} Werte übernehmen
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField
          label="Liste"
          hint="Zum Beispiel: Anna Admin 1620 — oder „Admin, Anna; 1620“."
        >
          {(p) => (
            <Textarea
              {...p}
              rows={8}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={'Anna Admin 1620\nMeik Mannschaft 1680'}
            />
          )}
        </FormField>

        {preview.matched.length > 0 && (
          <div className="rounded-xl bg-gray-50 p-3 text-sm">
            <p className="font-semibold text-gray-900">Wird übernommen</p>
            <ul className="mt-1 space-y-0.5 text-gray-700">
              {preview.matched.map((entry) => (
                <li key={entry.id}>
                  {entry.name} → {entry.qttr}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(preview.unmatched.length > 0 || preview.invalid.length > 0) && (
          <div className="rounded-xl bg-status-late-soft p-3 text-sm">
            <p className="font-semibold text-status-late">Nicht zugeordnet</p>
            <ul className="mt-1 space-y-0.5 text-gray-700">
              {preview.unmatched.map((entry) => (
                <li key={`u-${entry.name}`}>{entry.name} — kein Mitglied mit diesem Namen</li>
              ))}
              {preview.invalid.map((line) => (
                <li key={`i-${line}`}>{line} — kein Wert erkennbar</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}
