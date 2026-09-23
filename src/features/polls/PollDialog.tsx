import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Checkbox,
  DateInput,
  Dialog,
  FormField,
  IconButton,
  Input,
  MultiSelect,
  RichTextEditor,
  Select,
  useToast,
} from '../../components/ui';
import { fromBerlin } from '../../lib/dates';
import { useSession } from '../auth/session';
import type { GroupWithMembers } from '../members/api';
import type { TeamWithRoster } from '../teams/api';
import { useSavePoll, type PollWithDetails } from './api';
import {
  EMPTY_POLL,
  POLL_TYPE_HELP,
  POLL_TYPE_LABELS,
  TARGET_HINT,
  pollSchema,
  type PollValues,
} from './schemas';

const TYPE_OPTIONS = Object.entries(POLL_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export interface PollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = neue Umfrage anlegen. */
  poll: PollWithDetails | null;
  teams: TeamWithRoster[];
  groups: GroupWithMembers[];
}

export default function PollDialog({
  open,
  onOpenChange,
  poll,
  teams,
  groups,
}: PollDialogProps) {
  const { toast } = useToast();
  const { profile } = useSession();
  const savePoll = useSavePoll();
  // Nicht im Formularschema: Es ist keine Eigenschaft der Umfrage, sondern eine
  // Anweisung beim Anlegen.
  const [announce, setAnnounce] = useState(true);

  const form = useForm<PollValues>({
    resolver: zodResolver(pollSchema),
    defaultValues: EMPTY_POLL,
  });

  useEffect(() => {
    if (open) {
      form.reset(poll ? toFormValues(poll) : EMPTY_POLL);
      setAnnounce(true);
    }
  }, [open, poll, form]);

  const options = form.watch('options');
  const type = form.watch('type');

  async function onSubmit(values: PollValues) {
    try {
      await savePoll.mutateAsync({
        id: poll?.id ?? null,
        input: {
          poll: {
            title: values.title,
            details_html: values.detailsHtml,
            type: values.type,
            // Beim Typ „Personen" trägt man sich ein — mehr als ein Kreuz gibt es nicht.
            max_answers: values.type === 'persons' ? 1 : values.maxAnswers,
            expires_at: values.expiresAt
              ? fromBerlin(`${values.expiresAt}T23:59:00`).toISOString()
              : null,
            hide_results: values.hideResults,
            ...(poll ? {} : { created_by: profile?.id ?? null }),
          },
          teamIds: values.teamIds,
          groupIds: values.groupIds,
          options: values.options,
          announce: !poll && announce,
        },
      });
      toast(poll ? 'Umfrage gespeichert' : 'Umfrage angelegt', 'success');
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={poll ? `${poll.title} bearbeiten` : 'Umfrage anlegen'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button
            variant="primary"
            loading={form.formState.isSubmitting}
            onClick={form.handleSubmit(onSubmit)}
          >
            Speichern
          </Button>
        </>
      }
    >
      <form noValidate className="space-y-4">
        <FormField label="Mannschaft(en)" hint={TARGET_HINT}>
          {(p) => (
            <MultiSelect
              {...p}
              options={teams.map((team) => ({ value: team.id, label: team.name }))}
              value={form.watch('teamIds')}
              onChange={(value) => form.setValue('teamIds', value)}
              placeholder="Ganzer Verein"
            />
          )}
        </FormField>

        <FormField label="Gruppe(n)">
          {(p) => (
            <MultiSelect
              {...p}
              options={groups.map((group) => ({ value: group.id, label: group.name }))}
              value={form.watch('groupIds')}
              onChange={(value) => form.setValue('groupIds', value)}
              placeholder="Keine Gruppe"
            />
          )}
        </FormField>

        <FormField label="Name der Umfrage" required error={form.formState.errors.title?.message}>
          {(p) => <Input {...p} {...form.register('title')} placeholder="Termin für die Feier" />}
        </FormField>

        <FormField label="Details">
          {(p) => (
            <RichTextEditor
              {...p}
              value={form.watch('detailsHtml')}
              onChange={(value) => form.setValue('detailsHtml', value)}
              placeholder="Worum geht es?"
            />
          )}
        </FormField>

        <FormField label="Typ" hint={POLL_TYPE_HELP[type]}>
          {(p) => <Select {...p} {...form.register('type')} options={TYPE_OPTIONS} />}
        </FormField>

        <FormField
          label="Antworten"
          required
          error={
            form.formState.errors.options?.message ??
            (form.formState.errors.options as unknown as { root?: { message?: string } })?.root
              ?.message
          }
        >
          {() => (
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    aria-label={`Antwort ${index + 1}`}
                    value={option}
                    onChange={(event) =>
                      form.setValue(
                        'options',
                        options.map((entry, i) => (i === index ? event.target.value : entry)),
                      )
                    }
                  />
                  {options.length > 1 && (
                    <IconButton
                      icon={Trash2}
                      label={`Antwort ${index + 1} entfernen`}
                      tone="danger"
                      onClick={() =>
                        form.setValue(
                          'options',
                          options.filter((_, i) => i !== index),
                        )
                      }
                    />
                  )}
                </div>
              ))}

              {/* Beim Anlegen frei, beim Bearbeiten gesperrt: Antworten zu ersetzen
                  nähme die abgegebenen Stimmen mit, weil sie an der Antwort hängen. */}
              {!poll && (
                <Button onClick={() => form.setValue('options', [...options, ''])}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Antwort hinzufügen
                </Button>
              )}
              {poll && (
                <p className="text-xs text-gray-500">
                  Die Antworten einer laufenden Umfrage lassen sich nicht ändern — die
                  abgegebenen Stimmen hängen daran.
                </p>
              )}
            </div>
          )}
        </FormField>

        {type === 'vote' && (
          <FormField
            label="Maximale Antwortmöglichkeiten"
            hint="1 = Einfachauswahl, mehr = Mehrfachauswahl."
            error={form.formState.errors.maxAnswers?.message}
          >
            {(p) => (
              <Input
                {...p}
                {...form.register('maxAnswers', { valueAsNumber: true })}
                type="number"
                min={1}
                max={50}
              />
            )}
          </FormField>
        )}

        <FormField label="Ablaufdatum" hint="Leer lassen, wenn die Umfrage offen bleibt.">
          {(p) => <DateInput {...p} {...form.register('expiresAt')} />}
        </FormField>

        <Checkbox
          checked={form.watch('hideResults')}
          onCheckedChange={(value) => form.setValue('hideResults', value)}
          label="Antworten für Mitglieder nicht anzeigen"
          hint="Du selbst siehst die Ergebnisse weiterhin."
        />

        {!poll && (
          <Checkbox
            checked={announce}
            onCheckedChange={setAnnounce}
            label="Mitglieder benachrichtigen"
            hint="Die Zielgruppe bekommt einen Hinweis per App bzw. E-Mail, je nach ihren Einstellungen."
          />
        )}
      </form>
    </Dialog>
  );
}

export function toFormValues(poll: PollWithDetails): PollValues {
  return {
    title: poll.title,
    detailsHtml: poll.details_html,
    type: poll.type,
    maxAnswers: poll.max_answers,
    expiresAt: poll.expires_at ? poll.expires_at.slice(0, 10) : '',
    hideResults: poll.hide_results,
    teamIds: poll.teamIds,
    groupIds: poll.groupIds,
    options: poll.options.map((option) => option.text),
  };
}
