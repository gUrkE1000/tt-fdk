import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Checkbox,
  ColorInput,
  DateInput,
  Dialog,
  FormField,
  Input,
  PersonPicker,
  Select,
  Tabs,
  Textarea,
  useToast,
} from '../../components/ui';
import { RANKING_TYPE_LABELS } from '../../lib/labels';
import type { MemberSummary as Member } from '../members/api';
import { useCreateTeam, useSaveRoster, useUpdateTeam, type TeamWithRoster } from './api';
import {
  EMPTY_TEAM,
  LINEUP_MODE_HELP,
  LINEUP_MODE_LABELS,
  parseLeagues,
  teamSchema,
  type TeamValues,
} from './schemas';
import TeamRosterEditor from './TeamRosterEditor';

const RANKING_TYPE_OPTIONS = Object.entries(RANKING_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const LINEUP_MODE_OPTIONS = Object.entries(LINEUP_MODE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = neue Mannschaft anlegen. */
  team: TeamWithRoster | null;
  members: Member[];
}

export default function TeamDialog({ open, onOpenChange, team, members }: TeamDialogProps) {
  const { toast } = useToast();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const saveRoster = useSaveRoster();

  const form = useForm<TeamValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: EMPTY_TEAM,
  });

  useEffect(() => {
    if (open) form.reset(team ? toFormValues(team) : EMPTY_TEAM);
  }, [open, team, form]);

  async function onSubmit(values: TeamValues) {
    const row = {
      name: values.name,
      color: values.color,
      size: values.size,
      ranking_type: values.rankingType,
      ranking: values.ranking,
      leagues: values.leagues,
      lineup_mode: values.lineupMode,
      substitute_mode: values.substituteMode,
      substitute_timeout_hours: values.substituteTimeoutHours,
      hide_users_no_ranking: values.hideUsersNoRanking,
      block_participants_after: values.blockParticipantsAfter || null,
      comment_home_games: values.commentHomeGames,
      comment_away_games: values.commentAwayGames,
      arrival_minutes_home: values.arrivalMinutesHome,
      arrival_minutes_away: values.arrivalMinutesAway,
      manual_request_auto_add: values.manualRequestAutoAdd,
      hide_drivers_catering: values.hideDriversCatering,
      is_braunschweiger: values.isBraunschweiger,
      webcal_url: values.webcalUrl || null,
      sync_enabled: values.syncEnabled,
      active: values.active,
    };

    try {
      const id = team
        ? (await updateTeam.mutateAsync({ id: team.id, values: row }), team.id)
        : await createTeam.mutateAsync(row);

      await saveRoster.mutateAsync({
        teamId: id,
        leaderIds: values.leaderIds,
        regularIds: values.regularIds,
        substituteIds: values.substituteIds,
      });

      toast(team ? 'Mannschaft gespeichert' : 'Mannschaft angelegt', 'success');
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  const people = members.map((member) => ({
    id: member.id,
    name: member.full_name ?? '',
    detail: member.qttr != null ? `${member.qttr} QTTR` : undefined,
  }));

  const basics = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Name" required error={form.formState.errors.name?.message}>
          {(p) => <Input {...p} {...form.register('name')} placeholder="1. Herren" />}
        </FormField>
        <FormField label="Farbe" hint="Kennfarbe in Kalender und Listen.">
          {(p) => (
            <ColorInput
              {...p}
              value={form.watch('color')}
              onChange={(value) => form.setValue('color', value ?? '')}
            />
          )}
        </FormField>
        <FormField
          label="Anzahl Spieler"
          required
          hint="So viele stehen je Spiel am Tisch — die Zahl hinter dem Schrägstrich in „2/4“."
          error={form.formState.errors.size?.message}
        >
          {(p) => (
            <Input {...p} {...form.register('size', { valueAsNumber: true })} type="number" min={1} max={12} />
          )}
        </FormField>
        <FormField label="Rangtyp">
          {(p) => <Select {...p} {...form.register('rankingType')} options={RANKING_TYPE_OPTIONS} />}
        </FormField>
        <FormField label="Rang" hint="Zum Beispiel 2 für die zweite Mannschaft.">
          {(p) => (
            <Input
              {...p}
              {...form.register('ranking', { setValueAs: toNullableNumber })}
              type="number"
              min={1}
              max={99}
            />
          )}
        </FormField>
        <FormField label="Mannschaftsführer">
          {(p) => (
            <PersonPicker
              {...p}
              people={people}
              value={form.watch('leaderIds')}
              onChange={(value) => form.setValue('leaderIds', value)}
              placeholder="Niemand zugeordnet"
            />
          )}
        </FormField>
      </div>

      <FormField
        label="Ligen"
        hint="Kommagetrennt, in der Schreibweise eures Verbands."
      >
        {(p) => (
          <Input
            {...p}
            value={form.watch('leagues').join(', ')}
            onChange={(event) => form.setValue('leagues', parseLeagues(event.target.value))}
            placeholder="Bezirksliga, Bezirkspokal"
          />
        )}
      </FormField>

      <div className="space-y-2 rounded-xl bg-gray-50 p-3">
        <Checkbox
          checked={form.watch('isBraunschweiger')}
          onCheckedChange={(value) => form.setValue('isBraunschweiger', value)}
          label="Braunschweiger System"
          hint="Doppel vor Einzel. Ändert nur die Reihenfolge im geteilten Aufstellungstext."
        />
        <Checkbox
          checked={form.watch('active')}
          onCheckedChange={(value) => form.setValue('active', value)}
          label="Aktiv"
          hint="Inaktive Mannschaften verschwinden aus den Listen, ihre Spiele bleiben erhalten."
        />
      </div>
    </div>
  );

  const roster = (
    <div className="space-y-4">
      <FormField label="Spieler-Logik" hint={LINEUP_MODE_HELP[form.watch('lineupMode')]}>
        {(p) => <Select {...p} {...form.register('lineupMode')} options={LINEUP_MODE_OPTIONS} />}
      </FormField>

      <TeamRosterEditor
        members={members}
        size={form.watch('size')}
        regularIds={form.watch('regularIds')}
        substituteIds={form.watch('substituteIds')}
        onRegularsChange={(ids) => form.setValue('regularIds', ids)}
        onSubstitutesChange={(ids) => form.setValue('substituteIds', ids)}
        regularError={form.formState.errors.regularIds?.message}
        substituteError={form.formState.errors.substituteIds?.message}
      />

      <Checkbox
        checked={form.watch('hideUsersNoRanking')}
        onCheckedChange={(value) => form.setValue('hideUsersNoRanking', value)}
        label="Mitglieder ohne Rang für diese Mannschaft ausblenden"
      />
    </div>
  );

  const settings = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Ankunft vor Heimspielen (Minuten)">
          {(p) => (
            <Input
              {...p}
              {...form.register('arrivalMinutesHome', { valueAsNumber: true })}
              type="number"
              min={0}
              max={600}
            />
          )}
        </FormField>
        <FormField label="Ankunft vor Auswärtsspielen (Minuten)">
          {(p) => (
            <Input
              {...p}
              {...form.register('arrivalMinutesAway', { valueAsNumber: true })}
              type="number"
              min={0}
              max={600}
            />
          )}
        </FormField>
      </div>

      <FormField label="Standard-Hinweis bei Heimspielen">
        {(p) => <Textarea {...p} {...form.register('commentHomeGames')} rows={3} />}
      </FormField>
      <FormField label="Standard-Hinweis bei Auswärtsspielen">
        {(p) => <Textarea {...p} {...form.register('commentAwayGames')} rows={3} />}
      </FormField>

      <FormField
        label="Rückmeldungen sperren ab"
        hint="Ab diesem Tag können Spieler ihren Teilnahmestatus nicht mehr selbst ändern."
      >
        {(p) => <DateInput {...p} {...form.register('blockParticipantsAfter')} />}
      </FormField>

      <FormField
        label="Spielplan-Kalender (ICS)"
        hint="Die Adresse aus myTischtennis. Von dort holt der nächtliche Abgleich die Termine."
      >
        {(p) => <Input {...p} {...form.register('webcalUrl')} placeholder="https://" />}
      </FormField>

      <div className="space-y-2 rounded-xl bg-gray-50 p-3">
        <Checkbox
          checked={form.watch('syncEnabled')}
          onCheckedChange={(value) => form.setValue('syncEnabled', value)}
          label="Spielplan automatisch abgleichen"
        />
        <Checkbox
          checked={form.watch('hideDriversCatering')}
          onCheckedChange={(value) => form.setValue('hideDriversCatering', value)}
          label="Fahrdienst bei Spielen ausblenden"
        />
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={team ? `${team.name} bearbeiten` : 'Mannschaft anlegen'}
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
      <form noValidate>
        <Tabs
          tabs={[
            { value: 'basics', label: 'Stammdaten', content: basics },
            { value: 'roster', label: 'Kader', content: roster },
            { value: 'settings', label: 'Einstellungen', content: settings },
          ]}
        />
      </form>
    </Dialog>
  );
}

function toNullableNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function toFormValues(team: TeamWithRoster): TeamValues {
  return {
    name: team.name,
    color: team.color,
    size: team.size,
    rankingType: team.ranking_type,
    ranking: team.ranking,
    leagues: team.leagues ?? [],
    lineupMode: team.lineup_mode,
    substituteMode: team.substitute_mode,
    substituteTimeoutHours: team.substitute_timeout_hours,
    hideUsersNoRanking: team.hide_users_no_ranking,
    blockParticipantsAfter: team.block_participants_after ?? '',
    commentHomeGames: team.comment_home_games,
    commentAwayGames: team.comment_away_games,
    arrivalMinutesHome: team.arrival_minutes_home,
    arrivalMinutesAway: team.arrival_minutes_away,
    manualRequestAutoAdd: team.manual_request_auto_add,
    hideDriversCatering: team.hide_drivers_catering,
    isBraunschweiger: team.is_braunschweiger,
    webcalUrl: team.webcal_url ?? '',
    syncEnabled: team.sync_enabled,
    active: team.active,
    leaderIds: team.leaderIds,
    regularIds: team.regularIds,
    substituteIds: team.substituteIds,
  };
}
