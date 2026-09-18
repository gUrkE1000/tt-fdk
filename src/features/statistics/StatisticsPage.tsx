import { useMemo, useState } from 'react';
import { BarChart3, Download, Trophy } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  FormField,
  DateInput,
  PageHeader,
  ProgressBar,
  Table,
} from '../../components/ui';
import { downloadBlob } from '../members/workbook';
import { useTrainingStatistics } from './api';
import {
  EMPTY_PERIOD,
  formatRate,
  lastTwelveMonths,
  tallyByTraining,
  topAttendance,
  toCsv,
  type MemberTally,
  type TrainingTally,
} from './summary';

/**
 * Statistiken (Aufgabe 9.9).
 *
 * Ein Widget je Training und darunter die Rangliste der letzten zwölf Monate. Welche
 * Trainings hier auftauchen, entscheidet die Datenbank: `statistics_visibility` steht am
 * Training, und die View gibt nur her, was dieses Mitglied sehen darf. Wer nichts sehen
 * darf, sieht eine leere Seite — und keinen Hinweis darauf, was ihm entgeht.
 */
export default function StatisticsPage() {
  const statistics = useTrainingStatistics();
  const [period, setPeriod] = useState(EMPTY_PERIOD);

  const rows = statistics.data ?? [];

  const trainings = useMemo(() => tallyByTraining(rows, period), [rows, period]);
  const top = useMemo(() => topAttendance(rows, lastTwelveMonths()), [rows]);

  function exportCsv(tally: TrainingTally) {
    const blob = new Blob([toCsv(tally)], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `trainingsbeteiligung-${tally.trainingName.toLowerCase()}.csv`);
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      cell: (member: MemberTally) => (
        <span className="font-semibold text-gray-900">{member.name}</span>
      ),
    },
    { key: 'attended', header: 'Da', cell: (member: MemberTally) => member.attended },
    { key: 'declined', header: 'Abgesagt', cell: (member: MemberTally) => member.declined },
    {
      key: 'missing',
      header: 'Nicht gemeldet',
      cell: (member: MemberTally) => member.missing,
    },
    {
      key: 'rate',
      header: 'Quote',
      cell: (member: MemberTally) => (
        <div className="flex items-center gap-2">
          <ProgressBar value={member.attended} max={member.sessions} className="w-20" />
          <span className="tabular-nums">{formatRate(member.rate)}</span>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Statistiken"
        description="Wer war wie oft beim Training? Gezählt werden vergangene, nicht abgesagte Termine."
      />

      <Card className="mb-4">
        <CardBody className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <FormField label="Von">
            {(p) => (
              <DateInput
                {...p}
                value={period.from}
                onChange={(event) => setPeriod({ ...period, from: event.target.value })}
              />
            )}
          </FormField>
          <FormField label="Bis">
            {(p) => (
              <DateInput
                {...p}
                value={period.to}
                onChange={(event) => setPeriod({ ...period, to: event.target.value })}
              />
            )}
          </FormField>
          <Button onClick={() => setPeriod(EMPTY_PERIOD)}>Zurücksetzen</Button>
        </CardBody>
      </Card>

      {trainings.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Keine Auswertung"
          description="Entweder gab es im gewählten Zeitraum keine Trainingstermine, oder die Statistik dieser Trainings ist nicht für dich freigegeben."
        />
      ) : (
        <div className="space-y-4">
          {trainings.map((tally) => (
            <Card key={tally.trainingId}>
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-gray-900">{tally.trainingName}</h2>
                  <Badge tone="neutral">
                    {tally.sessions} {tally.sessions === 1 ? 'Termin' : 'Termine'}
                  </Badge>
                </div>
                <Button size="sm" onClick={() => exportCsv(tally)}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  CSV
                </Button>
              </CardHeader>
              <CardBody>
                <Table
                  columns={columns}
                  rows={tally.members}
                  rowKey={(member) => member.profileId}
                  mobileCard={(member) => (
                    <Card>
                      <CardBody className="space-y-1">
                        <p className="font-semibold text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-600">
                          {member.attended} von {member.sessions} · {formatRate(member.rate)}
                        </p>
                      </CardBody>
                    </Card>
                  )}
                />
              </CardBody>
            </Card>
          ))}

          {top.length > 0 && (
            <Card>
              <CardHeader className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-status-late" aria-hidden="true" />
                <h2 className="font-bold text-gray-900">Fleißigste der letzten zwölf Monate</h2>
              </CardHeader>
              <CardBody>
                <ol className="space-y-1.5">
                  {top.map((member, index) => (
                    <li key={member.profileId} className="flex items-baseline gap-2 text-sm">
                      <span className="w-5 shrink-0 text-right font-bold tabular-nums text-gray-400">
                        {index + 1}.
                      </span>
                      <span className="flex-1 font-semibold text-gray-900">{member.name}</span>
                      <span className="tabular-nums text-gray-600">
                        {member.attended}{' '}
                        {member.attended === 1 ? 'Teilnahme' : 'Teilnahmen'}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-gray-500">
                  Sortiert nach der Anzahl, nicht nach der Quote — wer an zwei von zwei Terminen
                  war, steht sonst über dem, der fünfzig von sechzig geschafft hat.
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
