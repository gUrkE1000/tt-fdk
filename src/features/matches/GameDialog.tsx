import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  DateInput,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
  TimeInput,
  useToast,
} from '../../components/ui';
import { fromBerlin, toBerlin } from '../../lib/dates';
import { useMembers } from '../members/api';
import { useVenues } from '../venues/api';
import type { TeamWithRoster } from '../teams/api';
import { useCreateMatch, useUpdateMatch, type MatchRow } from './api';
import { EMPTY_MATCH, matchSchema, toLocalIso, type MatchValues } from './schemas';

export interface GameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = neuen Spieltermin anlegen. */
  match: MatchRow | null;
  teams: TeamWithRoster[];
}

export default function GameDialog({ open, onOpenChange, match, teams }: GameDialogProps) {
  const { toast } = useToast();
  const createMatch = useCreateMatch();
  const updateMatch = useUpdateMatch();
  const venues = useVenues();
  const members = useMembers();

  const form = useForm<MatchValues>({
    resolver: zodResolver(matchSchema),
    defaultValues: EMPTY_MATCH,
  });

  useEffect(() => {
    if (open) form.reset(match ? toFormValues(match) : EMPTY_MATCH);
  }, [open, match, form]);

  // Die Sollzahl folgt der Mannschaft, solange niemand sie von Hand geändert hat.
  const teamId = form.watch('teamId');
  useEffect(() => {
    if (match) return;
    const team = teams.find((entry) => entry.id === teamId);
    if (team) form.setValue('requiredPlayers', team.size);
  }, [teamId, teams, match, form]);

  async function onSubmit(values: MatchValues) {
    const start = fromBerlin(toLocalIso(values.date, values.time));
    const end = new Date(start.getTime() + values.durationMinutes * 60_000);

    const row = {
      team_id: values.teamId,
      is_home: values.isHome,
      venue_id: values.venueId || null,
      location_text: values.locationText,
      opponent: values.opponent,
      league: values.league,
      summary: values.opponent ? `${teamName(values.teamId)} – ${values.opponent}` : teamName(values.teamId),
      required_players: values.requiredPlayers,
      supervisor_id: values.supervisorId || null,
      comment: values.comment,
      nuscore_code: values.nuscoreCode || null,
      nuscore_pin: values.nuscorePin || null,
      dtstart_external: start.toISOString(),
      dtend_external: end.toISOString(),
    };

    try {
      if (match) await updateMatch.mutateAsync({ id: match.id, values: row });
      else await createMatch.mutateAsync({ ...row, source: 'manual' });
      toast(match ? 'Spieltermin gespeichert' : 'Spieltermin angelegt', 'success');
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  function teamName(id: string): string {
    return teams.find((team) => team.id === id)?.name ?? '';
  }

  const venueOptions = [
    { value: '', label: 'Kein Ort hinterlegt' },
    ...(venues.data ?? [])
      .filter((venue) => venue.active && !venue.training_only)
      .map((venue) => ({ value: venue.id, label: venue.name })),
  ];

  const memberOptions = [
    { value: '', label: 'Nicht definiert' },
    ...(members.data ?? []).map((member) => ({
      value: member.id,
      label: member.full_name ?? '',
    })),
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={match ? 'Spieltermin bearbeiten' : 'Spiel anlegen'}
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
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Mannschaft" required error={form.formState.errors.teamId?.message}>
            {(p) => (
              <Select
                {...p}
                {...form.register('teamId')}
                placeholder="Bitte auswählen"
                options={teams.map((team) => ({ value: team.id, label: team.name }))}
              />
            )}
          </FormField>

          <FormField label="Spielort">
            {(p) => (
              <Select
                {...p}
                value={form.watch('isHome') ? 'home' : 'away'}
                onChange={(event) => form.setValue('isHome', event.target.value === 'home')}
                options={[
                  { value: 'home', label: 'Heim' },
                  { value: 'away', label: 'Auswärts' },
                ]}
              />
            )}
          </FormField>

          <FormField label="Datum" required error={form.formState.errors.date?.message}>
            {(p) => <DateInput {...p} {...form.register('date')} />}
          </FormField>

          <FormField label="Uhrzeit" required error={form.formState.errors.time?.message}>
            {(p) => <TimeInput {...p} {...form.register('time')} />}
          </FormField>

          <FormField
            label="Dauer (Minuten)"
            hint="Nur für den Kalender; das Spielende steht nirgends verbindlich."
            error={form.formState.errors.durationMinutes?.message}
          >
            {(p) => (
              <Input
                {...p}
                {...form.register('durationMinutes', { valueAsNumber: true })}
                type="number"
                min={30}
                max={720}
              />
            )}
          </FormField>

          <FormField
            label="Anzahl notwendige Spieler"
            required
            error={form.formState.errors.requiredPlayers?.message}
          >
            {(p) => (
              <Input
                {...p}
                {...form.register('requiredPlayers', { valueAsNumber: true })}
                type="number"
                min={1}
                max={12}
              />
            )}
          </FormField>

          <FormField label="Gegner">
            {(p) => <Input {...p} {...form.register('opponent')} placeholder="TTC Nachbarstadt" />}
          </FormField>

          <FormField label="Liga">
            {(p) => <Input {...p} {...form.register('league')} placeholder="Bezirksliga" />}
          </FormField>

          <FormField label="Ort">
            {(p) => <Select {...p} {...form.register('venueId')} options={venueOptions} />}
          </FormField>

          <FormField label="Betreuer">
            {(p) => <Select {...p} {...form.register('supervisorId')} options={memberOptions} />}
          </FormField>
        </div>

        <FormField
          label="Adresse als Text"
          hint="Für Auswärtsspiele, deren Halle nicht in euren Orten steht."
        >
          {(p) => <Input {...p} {...form.register('locationText')} />}
        </FormField>

        <FormField label="Kommentar für die Mannschaft">
          {(p) => <Textarea {...p} {...form.register('comment')} rows={3} />}
        </FormField>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Spiel-Code (digitaler Spielbericht)">
            {(p) => <Input {...p} {...form.register('nuscoreCode')} />}
          </FormField>
          <FormField label="Spiel-PIN (digitaler Spielbericht)">
            {(p) => <Input {...p} {...form.register('nuscorePin')} />}
          </FormField>
        </div>
      </form>
    </Dialog>
  );
}

export function toFormValues(match: MatchRow): MatchValues {
  const start = match.dtstart ? toBerlin(match.dtstart) : null;
  const durationMinutes =
    match.dtstart && match.dtend
      ? Math.round(
          (new Date(match.dtend).getTime() - new Date(match.dtstart).getTime()) / 60_000,
        )
      : EMPTY_MATCH.durationMinutes;

  return {
    teamId: match.team_id,
    date: start ? formatIsoDate(start) : '',
    time: start ? formatIsoTime(start) : EMPTY_MATCH.time,
    durationMinutes,
    isHome: match.is_home,
    venueId: match.venue_id ?? '',
    locationText: match.location_text ?? '',
    opponent: match.opponent ?? '',
    league: match.league ?? '',
    requiredPlayers: match.required_players,
    supervisorId: match.supervisor_id ?? '',
    comment: match.comment ?? '',
    nuscoreCode: match.nuscore_code ?? '',
    nuscorePin: match.nuscore_pin ?? '',
  };
}

function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatIsoTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
