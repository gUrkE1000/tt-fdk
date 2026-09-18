import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import deLocale from '@fullcalendar/core/locales/de';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  DateInput,
  Dialog,
  EmptyState,
  FormField,
  IconButton,
  PersonPicker,
  Table,
  Textarea,
  useToast,
} from '../../components/ui';
import { formatDate } from '../../lib/dates';
import { useMembers } from '../members/api';
import {
  useAllAbsences,
  useCreateAbsence,
  useDeleteAbsence,
  type Absence,
} from '../profile/api';

const HINT =
  'In diesem Kalender findest du alle eingetragenen Abwesenheiten des Vereins. Hier kannst ' +
  'du Abwesenheiten anlegen, bearbeiten oder löschen — auch solche, die Mitglieder selbst ' +
  'in ihrem Profil angelegt haben.';

/**
 * Abwesenheiten des ganzen Vereins (Aufgabe 7.3).
 *
 * Der Grund bleibt privat: Die View maskiert `comment_private` für alle außer dem
 * Mitglied selbst. Der Kalender zeigt deshalb nur Namen und Zeitraum — genau das, was
 * für die Aufstellungsplanung zählt.
 */
export default function AbsencesTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const absences = useAllAbsences();
  const members = useMembers();
  const createAbsence = useCreateAbsence();
  const deleteAbsence = useDeleteAbsence();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [comment, setComment] = useState('');

  const rows = absences.data ?? [];
  const memberList = members.data ?? [];
  const nameOf = (id: string | null) =>
    memberList.find((member) => member.id === id)?.full_name ?? 'Unbekannt';

  const events = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id ?? '',
        title: nameOf(row.profile_id),
        start: row.start_date as string,
        // FullCalendar behandelt `end` bei ganztägigen Terminen als exklusiv.
        end: new Date(new Date(`${row.end_date}T00:00:00Z`).getTime() + 86_400_000)
          .toISOString()
          .slice(0, 10),
        allDay: true,
        backgroundColor: '#B45309',
        borderColor: '#B45309',
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, memberList],
  );

  async function onSave() {
    if (profileIds.length === 0 || !startDate || !endDate) {
      toast('Bitte Mitglied und Zeitraum angeben', 'error');
      return;
    }

    try {
      for (const profileId of profileIds) {
        await createAbsence.mutateAsync({ profileId, startDate, endDate, comment });
      }
      setDialogOpen(false);
      setProfileIds([]);
      setStartDate('');
      setEndDate('');
      setComment('');
      toast('Abwesenheit gespeichert', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    }
  }

  async function onDelete(row: Absence) {
    try {
      await deleteAbsence.mutateAsync(row.id!);
      toast('Abwesenheit gelöscht', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Löschen fehlgeschlagen', 'error');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-600">{HINT}</p>
        {canManage && (
          <Button variant="primary" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Abwesenheit anlegen
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-2">
        <FullCalendar
          plugins={[dayGridPlugin, listPlugin]}
          locale={deLocale}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' }}
          buttonText={{ today: 'Heute', month: 'Monat', list: 'Liste' }}
          firstDay={1}
          height="auto"
          events={events}
          noEventsText="In diesem Zeitraum ist niemand abwesend."
        />
      </div>

      <Table
        columns={[
          { key: 'name', header: 'Mitglied', cell: (row: Absence) => nameOf(row.profile_id) },
          { key: 'from', header: 'Von', cell: (row: Absence) => formatDate(row.start_date!) },
          { key: 'to', header: 'Bis', cell: (row: Absence) => formatDate(row.end_date!) },
          {
            key: 'actions',
            header: 'Aktion',
            align: 'right',
            cell: (row: Absence) =>
              canManage ? (
                <IconButton
                  icon={Trash2}
                  label={`Abwesenheit von ${nameOf(row.profile_id)} löschen`}
                  tone="danger"
                  onClick={() => void onDelete(row)}
                />
              ) : null,
          },
        ]}
        rows={rows}
        rowKey={(row) => row.id!}
        mobileCard={(row) => (
          <Card>
            <CardBody className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">{nameOf(row.profile_id)}</p>
                <p className="text-sm text-gray-500">
                  {formatDate(row.start_date!)} – {formatDate(row.end_date!)}
                </p>
              </div>
              {canManage && (
                <IconButton
                  icon={Trash2}
                  label={`Abwesenheit von ${nameOf(row.profile_id)} löschen`}
                  tone="danger"
                  onClick={() => void onDelete(row)}
                />
              )}
            </CardBody>
          </Card>
        )}
        empty={<EmptyState title="Niemand ist abwesend" />}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Abwesenheit anlegen"
        footer={
          <>
            <Button onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button variant="primary" loading={createAbsence.isPending} onClick={() => void onSave()}>
              Speichern
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Mitglieder" required>
            {(p) => (
              <PersonPicker
                {...p}
                people={memberList.map((member) => ({
                  id: member.id,
                  name: member.full_name ?? '',
                }))}
                value={profileIds}
                onChange={setProfileIds}
              />
            )}
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Von" required>
              {(p) => (
                <DateInput
                  {...p}
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              )}
            </FormField>
            <FormField label="Bis" required>
              {(p) => (
                <DateInput
                  {...p}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              )}
            </FormField>
          </div>
          <FormField label="Kommentar" hint="Nur für das Mitglied selbst sichtbar.">
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            )}
          </FormField>
        </div>
      </Dialog>
    </div>
  );
}
