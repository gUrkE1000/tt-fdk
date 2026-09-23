import { useMemo, useState } from 'react';
import { FileSpreadsheet, Link2, Mail, Plus, TrendingUp, UserPlus } from 'lucide-react';
import {
  Button,
  Dialog,
  FilterBar,
  Menu,
  Select,
  useToast,
} from '../../components/ui';
import { ROLE_LABELS, STATUS_LABELS } from '../../lib/labels';
import {
  useActivateMember,
  useDeleteMember,
  useGroups,
  useAdminMembers,
  useRankings,
  type Member,
} from './api';
import { EMPTY_FILTERS, filterMembers, hasActiveFilters, type MemberFilters } from './filter';
import MemberTable from './MemberTable';
import MemberDialog from './MemberDialog';
import QttrDialog from './QttrDialog';
import InviteDialog from './InviteDialog';
import RegistrationLinkDialog from './RegistrationLinkDialog';
import ExcelDialog from './ExcelDialog';

const ROLE_OPTIONS = [
  { value: 'all', label: 'Alle Rollen' },
  ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Alle Status' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

export default function MembersTab() {
  const { toast } = useToast();
  const members = useAdminMembers();
  const rankings = useRankings();
  const groups = useGroups();
  const activateMember = useActivateMember();
  const deleteMember = useDeleteMember();

  const [filters, setFilters] = useState<MemberFilters>(EMPTY_FILTERS);
  const [editing, setEditing] = useState<Member | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qttrOpen, setQttrOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Member | null>(null);

  // Ohne useMemo wäre `?? []` bei jedem Rendern ein neues Array — und jedes useMemo,
  // das davon abhängt, rechnete jedes Mal neu.
  const groupList = useMemo(() => groups.data ?? [], [groups.data]);

  const groupMembers = useMemo(
    () => Object.fromEntries(groupList.map((group) => [group.id, group.memberIds])),
    [groupList],
  );

  const visible = useMemo(
    () => filterMembers(members.data ?? [], filters, { groupMembers }),
    [members.data, filters, groupMembers],
  );

  async function onActivate(member: Member) {
    try {
      await activateMember.mutateAsync(member.id);
      toast(`${member.full_name} ist freigeschaltet`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Freischalten fehlgeschlagen', 'error');
    }
  }

  async function onDeleteConfirmed() {
    if (!toDelete) return;
    try {
      await deleteMember.mutateAsync(toDelete.id);
      toast(`${toDelete.full_name} wurde gelöscht`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Löschen fehlgeschlagen', 'error');
    } finally {
      setToDelete(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          {visible.length} von {(members.data ?? []).length} Mitgliedern
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setExcelOpen(true)}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Excel Import &amp; Update
          </Button>
          <Button onClick={() => setQttrOpen(true)}>
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            QTTR-Update
          </Button>
          <Menu
            label="Mitglieder hinzufügen"
            icon={Plus}
            items={[
              {
                label: 'Per E-Mail einladen',
                icon: Mail,
                hint: 'Mehrere Adressen auf einmal — jede bekommt einen Anmeldelink.',
                onSelect: () => setInviteOpen(true),
              },
              {
                label: 'Mitglied anlegen',
                icon: UserPlus,
                hint: 'Auch ohne E-Mail-Adresse, etwa für Kinder.',
                onSelect: () => {
                  setEditing(null);
                  setDialogOpen(true);
                },
              },
              {
                label: 'Registrierungslink und QR-Code',
                icon: Link2,
                hint: 'Zum Aushängen oder Weiterleiten. Anmeldungen musst du freischalten.',
                onSelect: () => setLinkOpen(true),
              },
            ]}
          />
        </div>
      </div>

      <FilterBar
        search={filters.search}
        onSearchChange={(search) => setFilters({ ...filters, search })}
        searchPlaceholder="Name, E-Mail oder Mitgliedsnummer"
        onReset={() => setFilters(EMPTY_FILTERS)}
        resetDisabled={!hasActiveFilters(filters)}
      >
        <Select
          aria-label="Rolle"
          options={ROLE_OPTIONS}
          value={filters.role}
          onChange={(event) =>
            setFilters({ ...filters, role: event.target.value as MemberFilters['role'] })
          }
        />
        <Select
          aria-label="Status"
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={(event) =>
            setFilters({ ...filters, status: event.target.value as MemberFilters['status'] })
          }
        />
        <Select
          aria-label="Gruppe"
          options={[
            { value: 'all', label: 'Alle Gruppen' },
            ...groupList.map((group) => ({ value: group.id, label: group.name })),
          ]}
          value={filters.groupId}
          onChange={(event) => setFilters({ ...filters, groupId: event.target.value })}
        />
      </FilterBar>

      <MemberTable
        members={visible}
        rankings={rankings.data ?? []}
        groups={groupList}
        onEdit={(member) => {
          setEditing(member);
          setDialogOpen(true);
        }}
        onActivate={(member) => void onActivate(member)}
        onDelete={setToDelete}
      />

      <MemberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        member={editing}
        rankings={rankings.data ?? []}
        groups={groupList}
      />

      <QttrDialog open={qttrOpen} onOpenChange={setQttrOpen} members={members.data ?? []} />

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} members={members.data ?? []} />

      <RegistrationLinkDialog open={linkOpen} onOpenChange={setLinkOpen} />

      <ExcelDialog open={excelOpen} onOpenChange={setExcelOpen} />

      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`${toDelete?.full_name ?? 'Mitglied'} löschen?`}
        description="Das Mitglied verschwindet aus allen Listen. Vergangene Spiele und Aufstellungen bleiben nachvollziehbar."
        footer={
          <>
            <Button onClick={() => setToDelete(null)}>Abbrechen</Button>
            <Button variant="danger" onClick={() => void onDeleteConfirmed()}>
              Löschen
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Ein Administrator kann die Löschung rückgängig machen, solange das Konto nicht
          endgültig entfernt wurde.
        </p>
      </Dialog>
    </div>
  );
}
