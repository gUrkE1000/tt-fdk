import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  useToast,
} from '../../components/ui';
import { formatDateTime } from '../../lib/dates';
import { useMembers } from '../members/api';
import { useHandOverKey, useKeyHandovers, type KeyRow } from './api';
import { HANDOVER_MESSAGES, holderText } from './schemas';

export interface HandoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: KeyRow | null;
}

/**
 * „Schlüssel an Person übergeben" (Bestandsaufnahme F).
 *
 * Darunter steht der Weg des Schlüssels. Das ist kein Beiwerk: Die Frage im Verein
 * lautet selten „wer hat ihn?", sondern „wer hatte ihn zuletzt?" — nämlich dann,
 * wenn er weg ist.
 */
export default function HandoverDialog({ open, onOpenChange, entry }: HandoverDialogProps) {
  const { toast } = useToast();
  const members = useMembers();
  const handovers = useKeyHandovers(open && entry?.id ? entry.id : null);
  const handOver = useHandOverKey();

  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setTarget('');
    setNote('');
  }, [open, entry?.id]);

  const nameOf = useMemo(() => {
    const names = new Map((members.data ?? []).map((member) => [member.id, member.full_name ?? '']));
    return (id: string | null) => (id ? (names.get(id) ?? 'unbekannt') : 'niemand');
  }, [members.data]);

  const options = useMemo(
    () => [
      { value: '', label: 'Zurück an den Verantwortlichen' },
      ...(members.data ?? [])
        .filter((member) => member.status === 'active' && member.id !== entry?.holder_id)
        .map((member) => ({ value: member.id, label: member.full_name ?? '' })),
    ],
    [members.data, entry?.holder_id],
  );

  async function submit() {
    if (!entry?.id) return;

    try {
      const status = await handOver.mutateAsync({
        keyId: entry.id,
        to: target || null,
        note,
      });

      toast(HANDOVER_MESSAGES[status] ?? 'Das hat nicht geklappt', status === 'ok' ? 'success' : 'error');
      if (status === 'ok') onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Das hat nicht geklappt', 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? `${entry.name} übergeben` : 'Schlüssel übergeben'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button variant="primary" loading={handOver.isPending} onClick={() => void submit()}>
            Jetzt übergeben
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 p-3 text-sm">
          <p className="text-gray-500">Aktueller Inhaber</p>
          <p className="font-semibold text-gray-900">{entry ? holderText(entry) : '—'}</p>
        </div>

        <FormField label="Übergeben an">
          {(p) => (
            <Select
              {...p}
              options={options}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          )}
        </FormField>

        <FormField label="Bemerkung" hint="Optional — etwa, wo oder wann übergeben wurde.">
          {(p) => (
            <Input {...p} value={note} onChange={(event) => setNote(event.target.value)} />
          )}
        </FormField>

        {(handovers.data ?? []).length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Bisherige Übergaben
            </p>
            <ul className="space-y-1.5">
              {(handovers.data ?? []).map((row) => (
                <li key={row.id} className="text-sm text-gray-700">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span>{nameOf(row.from_profile_id)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                    <span className="font-semibold">{nameOf(row.to_profile_id)}</span>
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDateTime(row.created_at)}
                    {row.note ? ` · ${row.note}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}
