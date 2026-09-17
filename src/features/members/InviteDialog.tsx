import { useMemo, useState } from 'react';
import { Button, Dialog, FormField, Textarea, useToast } from '../../components/ui';
import { roleLabel } from '../../lib/labels';
import { supabase } from '../../lib/supabaseClient';
import { useCreateMember, type Member } from './api';
import { parseInviteLines, type InviteEntry } from './invite';

export interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
}

interface InviteResult {
  email: string;
  status: 'ok' | 'already_registered' | 'failed';
  detail?: string;
}

/**
 * Einladen heißt hier zweierlei: erst ein Profil anlegen (Status `unconfirmed`), dann
 * die Edge Function `invite-member` rufen, die die E-Mail verschickt. Zwei Schritte,
 * weil das Profil auch dann bestehen bleiben soll, wenn der Versand scheitert — der
 * Admin sieht das Mitglied dann in der Liste und kann es erneut einladen.
 */
export default function InviteDialog({ open, onOpenChange, members }: InviteDialogProps) {
  const { toast } = useToast();
  const createMember = useCreateMember();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<InviteResult[] | null>(null);
  const [running, setRunning] = useState(false);

  const parsed = useMemo(() => parseInviteLines(input), [input]);

  const known = useMemo(
    () => new Set(members.map((member) => member.email?.toLowerCase()).filter(Boolean) as string[]),
    [members],
  );

  const fresh = parsed.entries.filter((entry) => !known.has(entry.email));
  const duplicates = parsed.entries.filter((entry) => known.has(entry.email));

  async function onInvite() {
    setRunning(true);
    const collected: InviteResult[] = [];

    for (const entry of fresh) {
      try {
        const id = await createProfile(entry);
        const { error } = await supabase.functions.invoke('invite-member', {
          body: { profileId: id },
        });

        if (error) {
          const already = /already_registered/.test(error.message);
          collected.push({
            email: entry.email,
            status: already ? 'already_registered' : 'failed',
            detail: error.message,
          });
        } else {
          collected.push({ email: entry.email, status: 'ok' });
        }
      } catch (error) {
        collected.push({
          email: entry.email,
          status: 'failed',
          detail: error instanceof Error ? error.message : 'unbekannter Fehler',
        });
      }
    }

    setResults(collected);
    setRunning(false);

    const ok = collected.filter((result) => result.status === 'ok').length;
    if (ok > 0) toast(`${ok} Einladungen verschickt`, 'success');
    if (ok < collected.length) toast('Nicht alle Einladungen sind durchgegangen', 'error');
  }

  async function createProfile(entry: InviteEntry): Promise<string> {
    return createMember.mutateAsync({
      first_name: entry.firstName,
      last_name: entry.lastName,
      email: entry.email,
      role: entry.role,
      status: 'unconfirmed',
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setInput('');
          setResults(null);
        }
      }}
      size="lg"
      title="Mitglieder per E-Mail einladen"
      description="Je Zeile: Vorname Nachname E-Mail — optional dahinter die Rolle."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Schließen</Button>
          <Button
            variant="primary"
            disabled={fresh.length === 0}
            loading={running}
            onClick={() => void onInvite()}
          >
            {fresh.length} einladen
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Liste">
          {(p) => (
            <Textarea
              {...p}
              rows={7}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={'Anna Admin anna@example.com Admin\nMeik Mannschaft meik@example.com'}
            />
          )}
        </FormField>

        {fresh.length > 0 && (
          <div className="rounded-xl bg-gray-50 p-3 text-sm">
            <p className="font-semibold text-gray-900">Wird eingeladen</p>
            <ul className="mt-1 space-y-0.5 text-gray-700">
              {fresh.map((entry) => (
                <li key={entry.email}>
                  {entry.firstName} {entry.lastName} · {entry.email} · {roleLabel(entry.role)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(parsed.invalid.length > 0 || duplicates.length > 0) && (
          <div className="rounded-xl bg-status-late-soft p-3 text-sm">
            <p className="font-semibold text-status-late">Übersprungen</p>
            <ul className="mt-1 space-y-0.5 text-gray-700">
              {duplicates.map((entry) => (
                <li key={`d-${entry.email}`}>{entry.email} — gehört schon zum Verein</li>
              ))}
              {parsed.invalid.map((entry) => (
                <li key={`i-${entry.line}`}>
                  {entry.line} — {entry.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {results && (
          <div className="rounded-xl border border-gray-200 p-3 text-sm">
            <p className="font-semibold text-gray-900">Ergebnis</p>
            <ul className="mt-1 space-y-0.5 text-gray-700">
              {results.map((result) => (
                <li key={result.email}>
                  {result.email} —{' '}
                  {result.status === 'ok'
                    ? 'eingeladen'
                    : result.status === 'already_registered'
                      ? 'hat bereits ein Konto'
                      : `nicht zugestellt (${result.detail ?? 'unbekannt'})`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}
