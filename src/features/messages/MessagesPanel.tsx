import { useState } from 'react';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { Avatar, Button, IconButton, Textarea, useToast } from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatDateTime } from '../../lib/dates';
import { useSession } from '../auth/session';
import {
  messageProblem,
  useDeleteMessage,
  useMessages,
  usePostMessage,
  type MessageObject,
  type ObjectMessage,
} from './api';

export interface MessagesPanelProps {
  type: MessageObject;
  objectId: string;
  /** Zahl für die Beschriftung, solange der Faden zugeklappt ist. */
  count?: number;
  className?: string;
}

/**
 * Der Nachrichtenfaden an einer Termin-Karte (Aufgabe 9.2).
 *
 * Zugeklappt ist er eine Zeile mit Zähler; erst beim Aufklappen wird der Faden geladen.
 * Auf einer Seite mit zwanzig Spielterminen wären zwanzig Fäden sonst zwanzig Abfragen
 * für Text, den niemand liest.
 */
export default function MessagesPanel({ type, objectId, count, className }: MessagesPanelProps) {
  const { profile, role } = useSession();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const messages = useMessages(type, open ? objectId : null);
  const post = usePostMessage();
  const remove = useDeleteMessage();

  const profileId = profile?.id ?? null;
  const shown = count ?? messages.data?.length ?? 0;

  async function submit() {
    const problem = messageProblem(body);
    if (problem) {
      setError(problem);
      return;
    }
    if (!profileId) return;

    try {
      await post.mutateAsync({ type, objectId, authorId: profileId, body });
      setBody('');
      setError(null);
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Das hat nicht geklappt', 'error');
    }
  }

  async function onDelete(message: ObjectMessage) {
    if (!message.id) return;
    if (!window.confirm('Diese Nachricht löschen?')) return;

    try {
      await remove.mutateAsync(message.id);
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Löschen fehlgeschlagen', 'error');
    }
  }

  return (
    <div className={cn('rounded-xl border border-gray-200', className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className="flex min-h-touch w-full items-center gap-2 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <MessageSquare className="h-4 w-4 text-gray-400" aria-hidden="true" />
        Nachrichten ({shown})
      </button>

      {open && (
        <div className="space-y-3 border-t border-gray-200 p-3">
          {messages.isPending ? (
            <p className="text-sm text-gray-500">wird geladen …</p>
          ) : (messages.data ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">
              Noch nichts geschrieben. Die Beteiligten dieses Termins lesen mit.
            </p>
          ) : (
            <ul className="space-y-3">
              {(messages.data ?? []).map((message) => (
                <li key={message.id ?? ''} className="flex gap-2.5">
                  <Avatar name={message.author_name ?? ''} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-gray-500">
                      <span className="font-semibold text-gray-800">
                        {message.author_name ?? 'unbekannt'}
                      </span>
                      <span>{message.created_at ? formatDateTime(message.created_at) : ''}</span>
                      {message.edited && <span>· bearbeitet</span>}
                    </p>
                    {/* `whitespace-pre-line`: Absätze bleiben, aber es ist reiner Text —
                        kein Markup, also auch nichts zu bereinigen. */}
                    <p className="whitespace-pre-line text-sm text-gray-800">{message.body}</p>
                  </div>

                  {(message.author_id === profileId || role === 'admin') && (
                    <IconButton
                      label="Löschen"
                      icon={Trash2}
                      tone="danger"
                      onClick={() => void onDelete(message)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}

          {profileId && (
            <div className="space-y-1.5">
              <Textarea
                aria-label="Nachricht"
                rows={2}
                value={body}
                onChange={(event) => {
                  setBody(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="Kurze Nachricht an alle Beteiligten …"
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button size="sm" variant="primary" loading={post.isPending} onClick={() => void submit()}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Abschicken
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
