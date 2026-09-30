import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Checkbox,
  DateInput,
  Dialog,
  FormField,
  Input,
  MultiSelect,
  Select,
  Tabs,
  useToast,
} from '../../components/ui';
import {
  GENDER_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  formatRanking,
  parseRanking,
} from '../../lib/labels';
import {
  useCreateMember,
  useSaveRankings,
  useSetGroupMembers,
  useUpdateMember,
  type GroupWithMembers,
  type Member,
  type MemberRanking,
  type RankingInput,
  type RankingType,
} from './api';
import { memberSchema, validateRankings, type MemberValues } from './schemas';
import RankingEditor from './RankingEditor';

const GENDER_OPTIONS = Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label }));
const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

export interface MemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = neues Mitglied anlegen. */
  member: Member | null;
  rankings: MemberRanking[];
  groups: GroupWithMembers[];
}

export default function MemberDialog({
  open,
  onOpenChange,
  member,
  rankings,
  groups,
}: MemberDialogProps) {
  const { toast } = useToast();
  const createMember = useCreateMember();
  const updateMember = useUpdateMember();
  const saveRankings = useSaveRankings();
  const setGroupMembers = useSetGroupMembers();
  const [rankingError, setRankingError] = useState<string | null>(null);

  const defaults = useMemo(() => toFormValues(member, rankings, groups), [member, rankings, groups]);

  const form = useForm<MemberValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: defaults,
  });

  // Der Dialog bleibt gemountet; ohne das Zurücksetzen stünden beim nächsten Öffnen
  // noch die Daten des vorigen Mitglieds im Formular.
  useEffect(() => {
    if (open) {
      form.reset(defaults);
      setRankingError(null);
    }
  }, [open, defaults, form]);

  const groupOptions = groups.map((group) => ({ value: group.id, label: group.name }));

  async function onSubmit(values: MemberValues) {
    const rankingProblem = validateRankings(values.rankings);
    if (rankingProblem) {
      setRankingError(rankingProblem);
      return;
    }
    setRankingError(null);

    const row = {
      first_name: values.firstName,
      last_name: values.lastName,
      email: values.email?.trim() || null,
      phone: values.phone?.trim() || null,
      mobile_phone: values.mobilePhone?.trim() || null,
      gender: values.gender,
      birthday: values.birthday || null,
      member_number: values.memberNumber?.trim() || null,
      role: values.role,
      status: values.status,
      no_games: values.noGames,
      qttr: values.qttr,
      contact_visible: values.contactVisible,
      hide_birthday: values.hideBirthday,
    };

    try {
      const id = member
        ? (await updateMember.mutateAsync({ id: member.id, values: row }), member.id)
        : await createMember.mutateAsync(row);

      await saveRankings.mutateAsync({ profileId: id, rankings: toRankingInputs(values.rankings) });
      await saveGroupMemberships(id, values.groupIds);

      toast(member ? 'Mitglied gespeichert' : 'Mitglied angelegt', 'success');
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  /**
   * Gruppen hängen nicht am Mitglied, sondern an der Gruppe. Geändert wird deshalb je
   * betroffener Gruppe — und nur dort, wo sich die Zugehörigkeit wirklich ändert.
   */
  async function saveGroupMemberships(profileId: string, selected: string[]) {
    for (const group of groups) {
      const was = group.memberIds.includes(profileId);
      const now = selected.includes(group.id);
      if (was === now) continue;

      const memberIds = now
        ? [...group.memberIds, profileId]
        : group.memberIds.filter((id) => id !== profileId);
      await setGroupMembers.mutateAsync({ groupId: group.id, memberIds });
    }
  }

  const stammdaten = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Vorname" required error={form.formState.errors.firstName?.message}>
          {(p) => <Input {...p} {...form.register('firstName')} />}
        </FormField>
        <FormField label="Nachname" required error={form.formState.errors.lastName?.message}>
          {(p) => <Input {...p} {...form.register('lastName')} />}
        </FormField>
        <FormField
          label="E-Mail"
          hint="Ohne E-Mail kann sich das Mitglied nicht anmelden — für Kinder oft richtig so."
          error={form.formState.errors.email?.message}
        >
          {(p) => <Input {...p} {...form.register('email')} type="email" />}
        </FormField>
        <FormField label="Mitgliedsnummer">
          {(p) => <Input {...p} {...form.register('memberNumber')} />}
        </FormField>
        <FormField label="Telefon">
          {(p) => <Input {...p} {...form.register('phone')} type="tel" />}
        </FormField>
        <FormField label="Handy">
          {(p) => <Input {...p} {...form.register('mobilePhone')} type="tel" />}
        </FormField>
        <FormField label="Geschlecht">
          {(p) => <Select {...p} {...form.register('gender')} options={GENDER_OPTIONS} />}
        </FormField>
        <FormField label="Geburtstag">
          {(p) => <DateInput {...p} {...form.register('birthday')} />}
        </FormField>
      </div>
    </div>
  );

  const verein = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Rolle" hint="Bestimmt, was das Mitglied sehen und tun darf.">
          {(p) => <Select {...p} {...form.register('role')} options={ROLE_OPTIONS} />}
        </FormField>
        <FormField label="Status">
          {(p) => <Select {...p} {...form.register('status')} options={STATUS_OPTIONS} />}
        </FormField>
        <FormField label="QTTR" error={form.formState.errors.qttr?.message}>
          {(p) => (
            <Input
              {...p}
              {...form.register('qttr', { setValueAs: toNullableNumber })}
              type="number"
              min={0}
              max={3000}
            />
          )}
        </FormField>
        <FormField label="Gruppen">
          {(p) => (
            <MultiSelect
              {...p}
              options={groupOptions}
              value={form.watch('groupIds')}
              onChange={(value) => form.setValue('groupIds', value)}
              placeholder="Keine Gruppe"
            />
          )}
        </FormField>
      </div>

      <div className="space-y-2 rounded-xl bg-gray-50 p-3">
        <Checkbox
          checked={form.watch('noGames')}
          onCheckedChange={(value) => form.setValue('noGames', value)}
          label="Nimmt nicht am Spielbetrieb teil"
          hint="Reine Trainingsteilnehmer tauchen in keiner Aufstellung auf."
        />
        <Checkbox
          checked={form.watch('contactVisible')}
          onCheckedChange={(value) => form.setValue('contactVisible', value)}
          label="Kontaktdaten für alle Mitglieder sichtbar"
        />
        <Checkbox
          checked={form.watch('hideBirthday')}
          onCheckedChange={(value) => form.setValue('hideBirthday', value)}
          label="Geburtstag nicht anzeigen"
        />
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={member ? `${member.full_name ?? 'Mitglied'} bearbeiten` : 'Mitglied anlegen'}
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
      <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <Tabs
          tabs={[
            { value: 'basics', label: 'Stammdaten', content: stammdaten },
            { value: 'club', label: 'Verein', content: verein },
            {
              value: 'rankings',
              label: 'Ränge',
              content: (
                <RankingEditor
                  value={form.watch('rankings')}
                  onChange={(value) => form.setValue('rankings', value)}
                  error={rankingError ?? undefined}
                />
              ),
            },
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

export function toFormValues(
  member: Member | null,
  rankings: MemberRanking[],
  groups: GroupWithMembers[],
): MemberValues {
  const own = member ? rankings.filter((ranking) => ranking.profile_id === member.id) : [];

  return {
    firstName: member?.first_name ?? '',
    lastName: member?.last_name ?? '',
    email: member?.email ?? '',
    phone: member?.phone ?? '',
    mobilePhone: member?.mobile_phone ?? '',
    gender: member?.gender ?? 'unspecified',
    birthday: member?.birthday ?? '',
    memberNumber: member?.member_number ?? '',
    role: member?.role ?? 'member',
    status: member?.status ?? 'unconfirmed',
    noGames: member?.no_games ?? false,
    qttr: member?.qttr ?? null,
    contactVisible: member?.contact_visible ?? false,
    hideBirthday: member?.hide_birthday ?? false,
    groupIds: member
      ? groups.filter((group) => group.memberIds.includes(member.id)).map((group) => group.id)
      : [],
    rankings: Object.fromEntries(
      own.map((ranking) => [
        ranking.ranking_type,
        formatRanking(ranking.team_number, ranking.position_number),
      ]),
    ),
  };
}

export function toRankingInputs(rankings: Record<string, string>): RankingInput[] {
  const result: RankingInput[] = [];

  for (const [type, value] of Object.entries(rankings)) {
    if (!value.trim()) continue;
    const parsed = parseRanking(value);
    if (!parsed) continue;
    result.push({
      type: type as RankingType,
      teamNumber: parsed.teamNumber,
      positionNumber: parsed.positionNumber,
    });
  }

  return result;
}
