import { useMemo, useState } from 'react';
import { Mail, Phone, Users } from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  EmptyState,
  FilterBar,
  PageHeader,
  Table,
  Tabs,
} from '../../components/ui';
import Placeholder from '../../app/Placeholder';
import { roleLabel } from '../../lib/labels';
import { useClubSettings } from './api';
import { useClubRoles } from './rolesApi';
import NewsTab from './NewsTab';
import ClubTeamsTab from './ClubTeamsTab';
import ClubGamesTab from './ClubGamesTab';
import SessionsTab from '../trainings/SessionsTab';
import OpenTrainingsList from '../trainings/OpenTrainingsList';
import ClubEventsTab from './ClubEventsTab';
import { contactPeople, searchDirectory, useDirectory, type DirectoryEntry } from './directory';

export default function MyClubPage() {
  const settings = useClubSettings();

  return (
    <div>
      <PageHeader
        title="Mein Verein"
        description={settings.data?.club_name ?? undefined}
      />

      <Tabs
        tabs={[
          { value: 'members', label: 'Mitglieder', content: <MembersDirectory /> },
          { value: 'contacts', label: 'Rollen & Kontaktdaten', content: <Contacts /> },
          { value: 'trainings', label: 'Trainings', content: <ClubTrainingsTab /> },
          { value: 'events', label: 'Vereinstermine', content: <ClubEventsTab /> },
          { value: 'teams', label: 'Mannschaften', content: <ClubTeamsTab /> },
          { value: 'games', label: 'Spiele', content: <ClubGamesTab /> },
          { value: 'news', label: 'Neuigkeiten', content: <NewsTab /> },
          {
            value: 'files',
            label: 'Dateien',
            content: <Placeholder title="Vereinsdateien" task="9.4" />,
          },
          {
            value: 'about',
            label: 'Über den Verein',
            content: <About text={settings.data?.about_html ?? ''} />,
          },
        ]}
      />
    </div>
  );
}

/**
 * Trainings aus Mitgliedersicht: die eigenen Termine der nächsten zwei Wochen, darunter
 * die Liste der offenen Trainings zum Selbst-Eintragen. Dieselben Karten wie unter
 * „Trainings“ — wer hier zusagt, meldet sich genauso zurück.
 */
function ClubTrainingsTab() {
  return (
    <div className="space-y-6">
      <SessionsTab onlyMine />
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Offene Trainings
        </h2>
        <OpenTrainingsList />
      </div>
    </div>
  );
}

function MembersDirectory() {
  const directory = useDirectory();
  const [search, setSearch] = useState('');

  const rows = useMemo(
    () => searchDirectory(directory.data ?? [], search),
    [directory.data, search],
  );

  return (
    <div>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Name suchen"
        onReset={() => setSearch('')}
        resetDisabled={search === ''}
      />

      <p className="mb-3 text-sm text-gray-500">
        Kontaktdaten stehen hier nur, wenn das Mitglied sie freigegeben hat. Deine eigene
        Freigabe änderst du unter „Mein Profil“.
      </p>

      <Table
        columns={[
          { key: 'name', header: 'Name', cell: (entry: DirectoryEntry) => <NameCell entry={entry} /> },
          { key: 'role', header: 'Rolle', cell: (entry: DirectoryEntry) => roleLabel(entry.role) },
          { key: 'contact', header: 'Kontakt', cell: (entry: DirectoryEntry) => <ContactCell entry={entry} /> },
        ]}
        rows={rows}
        rowKey={(entry) => entry.id!}
        mobileCard={(entry) => (
          <Card>
            <CardBody className="space-y-1.5">
              <NameCell entry={entry} />
              <p className="text-sm text-gray-500">{roleLabel(entry.role)}</p>
              <ContactCell entry={entry} />
            </CardBody>
          </Card>
        )}
        empty={
          <EmptyState
            icon={Users}
            title="Niemand gefunden"
            description="Andere Schreibweise probieren oder die Suche leeren."
          />
        }
      />
    </div>
  );
}

function Contacts() {
  const directory = useDirectory();
  const people = contactPeople(directory.data ?? []);

  if (people.length === 0) {
    return <EmptyState icon={Users} title="Keine Ansprechpartner hinterlegt" />;
  }

  return (
    <div className="space-y-6">
      <ClubRolesList />

      <div className="space-y-3">
        <div>
          <h3 className="font-bold text-gray-900">Ansprechpartner in der Anwendung</h3>
          <p className="text-sm text-gray-600">
            Administratoren, Trainer und Mannschaftsführer — wer die Anwendung pflegt. Ein
            Amt ist etwas anderes: es steht oben.
          </p>
        </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {people.map((entry) => (
          <Card key={entry.id}>
            <CardBody className="flex items-start gap-3">
              <Avatar name={entry.full_name ?? ''} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">{entry.full_name}</p>
                <Badge tone="primary">{roleLabel(entry.role)}</Badge>
                <div className="mt-1">
                  <ContactCell entry={entry} />
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
      </div>
    </div>
  );
}

/** Die Ämter des Vereins (Aufgabe 9.6) — wen man wofür anspricht. */
function ClubRolesList() {
  const roles = useClubRoles();
  const entries = (roles.data ?? []).filter((role) => role.memberNames.length > 0);

  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-gray-900">Ämter</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map((role) => (
          <Card key={role.id}>
            <CardBody className="space-y-1">
              <p className="font-semibold text-gray-900">{role.name}</p>
              <p className="text-sm text-gray-700">{role.memberNames.join(', ')}</p>
              {role.description && <p className="text-sm text-gray-600">{role.description}</p>}
              {role.duties.length > 0 && (
                <ul className="list-inside list-disc text-sm text-gray-500">
                  {role.duties.map((duty) => (
                    <li key={duty}>{duty}</li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NameCell({ entry }: { entry: DirectoryEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-semibold text-gray-900">{entry.full_name}</span>
      {entry.qttr != null && <Badge tone="primary">{entry.qttr} QTTR</Badge>}
    </div>
  );
}

function ContactCell({ entry }: { entry: DirectoryEntry }) {
  const phone = entry.mobile_phone ?? entry.phone;

  if (!entry.email && !phone) {
    return <span className="text-sm text-gray-400">nicht freigegeben</span>;
  }

  return (
    <div className="flex flex-col gap-0.5 text-sm">
      {entry.email && (
        <a className="inline-flex items-center gap-1.5 text-primary" href={`mailto:${entry.email}`}>
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
          {entry.email}
        </a>
      )}
      {phone && (
        <a className="inline-flex items-center gap-1.5 text-primary" href={`tel:${phone}`}>
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          {phone}
        </a>
      )}
    </div>
  );
}

function About({ text }: { text: string }) {
  if (!text.trim()) {
    return (
      <EmptyState
        title="Noch nichts hinterlegt"
        description="Ein Administrator kann hier unter „Verein → Daten“ etwas über den Verein schreiben."
      />
    );
  }

  // Bewusst als Text, nicht als HTML: fremdes Markup ungeprüft einzuhängen wäre ein
  // offenes Scheunentor. Ein richtiger Editor mit Bereinigung kommt in Phase 9.
  return <p className="whitespace-pre-wrap text-gray-800">{text}</p>;
}
