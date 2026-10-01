import { useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Mail, Phone, Users } from 'lucide-react';
import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  FilterBar,
  PageHeader,
  Table,
  Tabs,
  ErrorState,
  LoadingState,
} from '../../components/ui';
import { roleLabel } from '../../lib/labels';
import { useClubSettings } from './api';
import { useSession } from '../auth/session';
import ClubDataTab from './ClubDataTab';
import AdminPage from '../admin/AdminPage';
import NewsTab from './NewsTab';
import { searchDirectory, useDirectory, type DirectoryEntry } from './directory';

/**
 * Reiter, die es nicht mehr gibt: Trainings stehen in der Übersicht, Termine unter
 * „Meine Termine", Spiele unter „Meine Spiele". Mannschaften, Ämter und die
 * Zuordnungs-Übersicht sind auf Wunsch weggefallen.
 */
const MOVED_TABS: Record<string, string> = {
  trainings: '/?tab=trainings',
  events: '/my-dates',
  games: '/my-games',
  files: '/my-club',
  teams: '/my-club',
  contacts: '/my-club',
  overview: '/my-club',
};

/**
 * „Verein" — für alle dieselbe Seite. Mitglieder lesen, der Administrator bearbeitet in
 * denselben Reitern (Neuigkeiten, Ämter) und hat dazu Daten, Übersicht und Betrieb.
 * Früher waren das zwei Menüpunkte („Mein Verein" und „Verein"); `/club` leitet her.
 */
export default function MyClubPage() {
  const settings = useClubSettings();
  const isAdmin = useSession().role === 'admin';
  // Der Reiter steht in der Adresse, damit Links aus Benachrichtigungen und aus
  // „Offen für dich" direkt dort landen (z. B. /my-club?tab=news).
  const [search, setSearch] = useSearchParams();
  const tab = search.get('tab') ?? 'members';
  const about = settings.data?.about_html ?? '';

  // Frühere Reiter, deren Inhalt es an anderer Stelle schon gibt — alte Links führen dorthin.
  const moved = MOVED_TABS[tab];
  if (moved) return <Navigate to={moved} replace />;

  return (
    <div>
      <PageHeader
        title="Verein"
        description={settings.data?.club_name ?? undefined}
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setSearch({ tab: value }, { replace: true })}
        tabs={[
          {
            value: 'members',
            label: 'Mitglieder',
            // Neu aufgebaut, wenn die Suche einen anderen Namen mitbringt — auch wenn man
            // schon auf dieser Seite ist.
            content: <MembersDirectory key={search.get('q') ?? ''} />,
          },
          { value: 'news', label: 'Neuigkeiten', content: <NewsTab canEdit={isAdmin} /> },
          // Ohne Text gibt es für Mitglieder nichts zu lesen; der Administrator schreibt ihn
          // unter „Daten".
          ...(about.trim() !== ''
            ? [{ value: 'about', label: 'Über den Verein', content: <About text={about} /> }]
            : []),
          // Nur für den Administrator: verwalten, was oben alle lesen.
          ...(isAdmin
            ? [
                { value: 'data', label: 'Daten', content: <ClubDataTab /> },
                { value: 'operations', label: 'Betrieb', content: <AdminPage /> },
              ]
            : []),
        ]}
      />
    </div>
  );
}

function MembersDirectory() {
  const directory = useDirectory();
  // Vorbelegt aus der Adresse: Ein Treffer der globalen Suche landet hier als
  // /my-club?tab=members&q=<Name>.
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');

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
          directory.isLoading ? (
            <LoadingState />
          ) : directory.isError ? (
            <ErrorState onRetry={() => void directory.refetch()} />
          ) : (
          <EmptyState
            icon={Users}
            title="Niemand gefunden"
            description="Andere Schreibweise probieren oder die Suche leeren."
          />
          )
        }
      />
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
