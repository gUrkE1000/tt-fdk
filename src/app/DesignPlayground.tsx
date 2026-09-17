import { useState } from 'react';
import { Users, Trash2, Pencil, CalendarDays } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  ColorInput,
  DateInput,
  Dialog,
  Drawer,
  EmptyState,
  FilterBar,
  FormField,
  IconButton,
  Input,
  MultiSelect,
  PageHeader,
  PersonPicker,
  ProgressBar,
  Select,
  SortableList,
  StatTile,
  Table,
  Tabs,
  Textarea,
  TimeInput,
  useToast,
  type BadgeTone,
} from '../components/ui';

const TONES: BadgeTone[] = [
  'neutral',
  'primary',
  'yes',
  'late',
  'unclear',
  'no',
  'open',
  'absent',
  'removed',
  'warning',
  'info',
];

const PEOPLE = [
  { id: 'p1', name: 'Anna Beispiel', detail: '1.1 · 1620 QTTR' },
  { id: 'p2', name: 'Bernd Muster', detail: '1.2 · 1580 QTTR' },
  { id: 'p3', name: 'Clara Probe', detail: '1.3 · 1490 QTTR' },
  { id: 'p4', name: 'Dieter Test', detail: '2.1 · 1375 QTTR' },
];

interface DemoRow {
  id: string;
  name: string;
  team: string;
  status: BadgeTone;
}

const ROWS: DemoRow[] = [
  { id: 'r1', name: 'Anna Beispiel', team: 'Erwachsene I', status: 'yes' },
  { id: 'r2', name: 'Bernd Muster', team: 'Erwachsene I', status: 'no' },
  { id: 'r3', name: 'Clara Probe', team: 'Erwachsene II', status: 'open' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="mb-3 border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide text-gray-500">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/**
 * Sichtprüfung aller Primitives an einem Ort. Nur im Entwicklungsmodus erreichbar
 * (/_design) — beim Bauen einer neuen Seite ist das die Referenz, wie etwas aussehen soll.
 */
export default function DesignPlayground() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checked, setChecked] = useState(true);
  const [color, setColor] = useState<string | null>('#0d9488');
  const [picked, setPicked] = useState<string[]>(['p1']);
  const [multi, setMulti] = useState<string[]>([]);
  const [order, setOrder] = useState(['p1', 'p2', 'p3']);
  const [search, setSearch] = useState('');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title="Design-System"
        description="Alle Primitives in allen Varianten. Nur im Entwicklungsmodus erreichbar."
        actions={<Button variant="primary">Primäraktion</Button>}
      />

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primär</Button>
          <Button variant="secondary">Sekundär</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Löschen</Button>
          <Button variant="primary" loading>
            Lädt
          </Button>
          <Button variant="primary" disabled>
            Deaktiviert
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Klein</Button>
          <Button size="md">Mittel</Button>
          <Button size="lg">Groß</Button>
          <IconButton icon={Pencil} label="Bearbeiten" />
          <IconButton icon={Trash2} label="Löschen" tone="danger" />
        </div>
        <Button block variant="primary">
          Volle Breite (Smartphone)
        </Button>
      </Section>

      <Section title="Badges und Status">
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Avatar name="Anna Beispiel" size="sm" />
          <Avatar name="Bernd Muster" />
          <ProgressBar value={3} max={4} warnBelowMax className="max-w-xs" />
          <ProgressBar value={4} max={4} warnBelowMax className="max-w-xs" />
        </div>
      </Section>

      <Section title="Kacheln">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Nächstes Spiel" value="21 Tage" icon={CalendarDays} />
          <StatTile label="Offene Rückmeldungen" value={7} tone="warning" hint="bei 3 Spielen" />
          <StatTile label="Zusagen" value="4/4" tone="success" />
        </div>
      </Section>

      <Section title="Karte">
        <Card accentColor="#0d9488">
          <CardHeader>
            <div>
              <p className="font-bold text-gray-900">TTC Beispiel II</p>
              <p className="text-sm text-gray-500">Sa. 12.10. um 18:00 Uhr · Bezirksklasse</p>
            </div>
            <Badge tone="primary">Heim</Badge>
          </CardHeader>
          <CardBody>
            <ProgressBar value={3} max={4} warnBelowMax />
          </CardBody>
          <CardFooter>
            <Button size="sm" variant="secondary">
              Spieler verwalten
            </Button>
            <Button size="sm" variant="ghost">
              Aufstellung teilen
            </Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Formularfelder">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Name" required hint="Wie die Mannschaft im Spielplan heißt">
            {(p) => <Input {...p} placeholder="Erwachsene I" />}
          </FormField>
          <FormField label="E-Mail" error="Diese Adresse ist bereits vergeben">
            {(p) => <Input {...p} type="email" defaultValue="doppelt@example.com" />}
          </FormField>
          <FormField label="Rhythmus">
            {(p) => (
              <Select
                {...p}
                options={[
                  { value: 'weekly', label: 'wöchentlich' },
                  { value: 'biweekly', label: 'zweiwöchentlich' },
                  { value: 'monthly', label: 'monatlich' },
                ]}
              />
            )}
          </FormField>
          <FormField label="Datum">{(p) => <DateInput {...p} />}</FormField>
          <FormField label="Uhrzeit">{(p) => <TimeInput {...p} />}</FormField>
          <FormField label="Mannschaftsfarbe">
            {(p) => <ColorInput {...p} value={color} onChange={setColor} />}
          </FormField>
          <FormField label="Hinweis an die Mannschaft" className="sm:col-span-2">
            {(p) => <Textarea {...p} placeholder="Treffpunkt 17:00 Uhr an der Halle" />}
          </FormField>
          <FormField label="Stammspieler (max. 4)" className="sm:col-span-2">
            {(p) => <PersonPicker {...p} people={PEOPLE} value={picked} onChange={setPicked} max={4} />}
          </FormField>
          <FormField label="Ligen" className="sm:col-span-2">
            {(p) => (
              <MultiSelect
                {...p}
                options={[
                  { value: 'bk', label: 'Bezirksklasse' },
                  { value: 'kl', label: 'Kreisliga' },
                  { value: 'ka', label: 'Kreisklasse A' },
                ]}
                value={multi}
                onChange={setMulti}
              />
            )}
          </FormField>
        </div>
        <Checkbox
          checked={checked}
          onCheckedChange={setChecked}
          label="Kein Training an gesetzlichen Feiertagen"
          hint="Betrifft alle Termine dieses Trainings"
        />
      </Section>

      <Section title="Reihenfolge (Ersatzspieler)">
        <SortableList
          numbered
          items={order.map((id) => ({
            id,
            content: <span className="text-sm">{PEOPLE.find((p) => p.id === id)?.name}</span>,
          }))}
          onReorder={setOrder}
        />
      </Section>

      <Section title="Filter und Tabelle">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          onReset={() => setSearch('')}
          resetDisabled={search === ''}
        >
          <Select
            options={[
              { value: '', label: 'Alle Mannschaften' },
              { value: '1', label: 'Erwachsene I' },
            ]}
            className="w-auto"
          />
        </FilterBar>
        <Table
          columns={[
            { key: 'name', header: 'Name', cell: (r: DemoRow) => r.name },
            { key: 'team', header: 'Mannschaft', cell: (r: DemoRow) => r.team },
            {
              key: 'status',
              header: 'Status',
              align: 'right',
              cell: (r: DemoRow) => <Badge tone={r.status}>{r.status}</Badge>,
            },
          ]}
          rows={ROWS}
          rowKey={(r) => r.id}
          mobileCard={(r) => (
            <Card>
              <CardBody className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-500">{r.team}</p>
                </div>
                <Badge tone={r.status}>{r.status}</Badge>
              </CardBody>
            </Card>
          )}
        />
      </Section>

      <Section title="Leerer Zustand">
        <EmptyState
          icon={Users}
          title="Noch keine Mitglieder"
          description="Lade die ersten Mitglieder per E-Mail ein oder lege sie von Hand an."
          action={<Button variant="primary">Mitglieder hinzufügen</Button>}
        />
      </Section>

      <Section title="Schichten und Rückmeldungen">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDialogOpen(true)}>Dialog öffnen</Button>
          <Button onClick={() => setDrawerOpen(true)}>Drawer öffnen</Button>
          <Button onClick={() => toast('Aufstellung kopiert', 'success')}>Toast: Erfolg</Button>
          <Button onClick={() => toast('Speichern fehlgeschlagen', 'error')}>Toast: Fehler</Button>
          <Button onClick={() => toast('Termin wurde verlegt', 'warning')}>Toast: Warnung</Button>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Spieler verwalten"
          description="Erwachsene I gegen TTC Beispiel II"
          footer={
            <>
              <Button onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button variant="primary" onClick={() => setDialogOpen(false)}>
                Speichern
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-600">Inhalt des Dialogs.</p>
        </Dialog>

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Filter">
          <p className="text-sm text-gray-600">Inhalt des Drawers.</p>
        </Drawer>
      </Section>

      <Section title="Tabs">
        <Tabs
          tabs={[
            {
              value: 'open',
              label: 'Offene Termine',
              count: 16,
              content: <p className="text-sm text-gray-600">16 offene Termine.</p>,
            },
            {
              value: 'done',
              label: 'Beendete Termine',
              count: 0,
              content: <p className="text-sm text-gray-600">Noch keine beendeten Termine.</p>,
            },
          ]}
        />
      </Section>
    </div>
  );
}
