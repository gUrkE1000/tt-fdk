/**
 * Trainingsbeteiligung auswerten (Aufgabe 9.9) — als reine Funktionen.
 *
 * Eine Statistik, die falsch rechnet, merkt niemand: Sie sieht aus wie eine Statistik.
 * Deshalb steht hier jede Regel einzeln und ist einzeln geprüft — besonders die
 * Unterscheidung zwischen „abgesagt" und „gar nicht gemeldet", denn genau daran hängt,
 * ob jemand am Jahresende zu Recht in der Liste steht.
 */

export interface StatisticsRow {
  training_id: string | null;
  training_name: string | null;
  profile_id: string | null;
  full_name: string | null;
  session_date: string | null;
  /** `yes`, `late`, `no` oder `none` (nicht gemeldet). */
  status: string | null;
}

export interface MemberTally {
  profileId: string;
  name: string;
  /** Zusagen, „komme später" eingeschlossen — beides heißt: war da. */
  attended: number;
  declined: number;
  /** Eingetragen, aber ohne Rückmeldung. */
  missing: number;
  sessions: number;
  /** Anteil der Anwesenheit, 0–1. Ohne Termine: null statt einer erfundenen Null. */
  rate: number | null;
}

export interface TrainingTally {
  trainingId: string;
  trainingName: string;
  sessions: number;
  members: MemberTally[];
}

/** „Da gewesen" heißt zugesagt oder später gekommen. */
export function isAttendance(status: string | null): boolean {
  return status === 'yes' || status === 'late';
}

export interface Period {
  /** ISO-Datum, einschließlich. Leer = keine untere Grenze. */
  from: string;
  /** ISO-Datum, einschließlich. Leer = keine obere Grenze. */
  to: string;
}

export const EMPTY_PERIOD: Period = { from: '', to: '' };

export function inPeriod(date: string | null, period: Period): boolean {
  if (!date) return false;
  if (period.from && date < period.from) return false;
  if (period.to && date > period.to) return false;
  return true;
}

/** Die letzten zwölf Monate — der Zeitraum der Rangliste. */
export function lastTwelveMonths(now: Date = new Date()): Period {
  const from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  return { from: iso(from), to: iso(now) };
}

/**
 * Je Training eine Auswertung, je Mitglied eine Zeile.
 *
 * `sessions` zählt die **unterschiedlichen Termine** im Zeitraum, nicht die Zeilen: Sonst
 * hätte ein Training mit zehn Mitgliedern zehnmal so viele „Termine" wie eines mit einem.
 */
export function tallyByTraining(rows: StatisticsRow[], period: Period = EMPTY_PERIOD): TrainingTally[] {
  const trainings = new Map<
    string,
    { name: string; dates: Set<string>; members: Map<string, MemberTally> }
  >();

  for (const row of rows) {
    if (!row.training_id || !row.profile_id) continue;
    if (!inPeriod(row.session_date, period)) continue;

    const training = trainings.get(row.training_id) ?? {
      name: row.training_name ?? '',
      dates: new Set<string>(),
      members: new Map<string, MemberTally>(),
    };
    trainings.set(row.training_id, training);

    if (row.session_date) training.dates.add(row.session_date);

    const member = training.members.get(row.profile_id) ?? {
      profileId: row.profile_id,
      name: row.full_name ?? '',
      attended: 0,
      declined: 0,
      missing: 0,
      sessions: 0,
      rate: null,
    };

    member.sessions += 1;
    if (isAttendance(row.status)) member.attended += 1;
    else if (row.status === 'no') member.declined += 1;
    else member.missing += 1;

    training.members.set(row.profile_id, member);
  }

  return [...trainings.entries()]
    .map(([trainingId, training]) => ({
      trainingId,
      trainingName: training.name,
      sessions: training.dates.size,
      members: [...training.members.values()]
        .map((member) => ({
          ...member,
          rate: member.sessions > 0 ? member.attended / member.sessions : null,
        }))
        .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || a.name.localeCompare(b.name, 'de')),
    }))
    .sort((a, b) => a.trainingName.localeCompare(b.trainingName, 'de'));
}

/**
 * Die Rangliste über alle sichtbaren Trainings.
 *
 * Sortiert nach der **Anzahl** der Teilnahmen, nicht nach dem Anteil: Wer an zwei von zwei
 * Terminen war, steht sonst über dem, der fünfzig von sechzig geschafft hat — und die
 * Ehrung am Jahresende meint offensichtlich den zweiten.
 */
export function topAttendance(
  rows: StatisticsRow[],
  period: Period = EMPTY_PERIOD,
  limit = 10,
): MemberTally[] {
  const members = new Map<string, MemberTally>();

  for (const row of rows) {
    if (!row.profile_id) continue;
    if (!inPeriod(row.session_date, period)) continue;

    const member = members.get(row.profile_id) ?? {
      profileId: row.profile_id,
      name: row.full_name ?? '',
      attended: 0,
      declined: 0,
      missing: 0,
      sessions: 0,
      rate: null,
    };

    member.sessions += 1;
    if (isAttendance(row.status)) member.attended += 1;
    else if (row.status === 'no') member.declined += 1;
    else member.missing += 1;

    members.set(row.profile_id, member);
  }

  return [...members.values()]
    .map((member) => ({
      ...member,
      rate: member.sessions > 0 ? member.attended / member.sessions : null,
    }))
    .filter((member) => member.attended > 0)
    .sort((a, b) => b.attended - a.attended || a.name.localeCompare(b.name, 'de'))
    .slice(0, limit);
}

/** „83 %" — oder ein Gedankenstrich, wenn es nichts zu rechnen gab. */
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)} %`;
}

/**
 * Die Auswertung als CSV.
 *
 * Semikolon als Trennzeichen und ein BOM davor: So öffnet Excel in einer deutschen
 * Installation die Datei richtig, statt alles in eine Spalte zu legen und Umlaute zu
 * zerlegen.
 */
export function toCsv(tally: TrainingTally): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const lines = [
    ['Name', 'Teilnahmen', 'Absagen', 'Keine Rückmeldung', 'Termine', 'Quote'].join(';'),
    ...tally.members.map((member) =>
      [
        escape(member.name),
        member.attended,
        member.declined,
        member.missing,
        member.sessions,
        escape(formatRate(member.rate)),
      ].join(';'),
    ),
  ];

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
