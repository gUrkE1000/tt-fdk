import { useContext, useEffect, useState } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Check, Clock, HelpCircle, X } from 'lucide-react';
import { Button, buttonClasses, Card, CardBody } from '../../components/ui';
import { supabase } from '../../lib/supabaseClient';

type Answer = 'yes' | 'no' | 'unclear' | 'late';

interface TokenInfo {
  status: string;
  action?: string;
  summary?: string;
}

interface AnswerResult {
  status: string;
  answer?: string;
  summary?: string;
}

const ANSWER_LABEL: Record<Answer, string> = {
  yes: 'Zusage',
  no: 'Absage',
  unclear: 'Unsicher',
  late: 'Komme später',
};

/** „Deine Zusage ist gespeichert." — „Deine Komme später" wäre kein Deutsch. */
const OUTCOME_TEXT: Record<Answer, string> = {
  yes: 'Deine Zusage ist gespeichert.',
  no: 'Deine Absage ist gespeichert.',
  unclear: 'Deine Antwort „Unsicher" ist gespeichert.',
  late: 'Deine Antwort „Komme später" ist gespeichert.',
};

/**
 * Was die Seite je Art des Links fragt und anbietet. Ein Vereinstermin und eine
 * Ersatzanfrage kennen kein „unsicher" — die Datenbank lehnt es dort ab.
 */
const PROMPTS: Record<string, { title: string; answers: Answer[] }> = {
  match_response: { title: 'Kannst du spielen?', answers: ['yes', 'unclear', 'no'] },
  substitute_answer: { title: 'Kannst du als Ersatz einspringen?', answers: ['yes', 'no'] },
  event_response: { title: 'Bist du dabei?', answers: ['yes', 'no'] },
  training_response: { title: 'Kommst du zum Training?', answers: ['yes', 'late', 'no'] },
};

const DEFAULT_PROMPT = PROMPTS.match_response;

/**
 * Die Seite hinter dem Link aus einer Benachrichtigung.
 *
 * Sie funktioniert ohne Anmeldung — das ist der Unterschied zwischen einer
 * Rückmeldequote von fünfzig und von neunzig Prozent. Was der Token erlaubt, ist eng
 * gefasst: eine Antwort, zu einem Termin, einmal.
 *
 * Gespeichert wird erst nach einem Klick. Eine Antwort in der Adresse (`?a=yes`) wählt
 * den Knopf nur vor: Mailprogramme lassen Links von Sicherheitsscannern öffnen, oft mit
 * JavaScript — ein sofortiges Speichern hätte im Namen des Empfängers geantwortet und
 * den Einmal-Link verbraucht, bevor er ihn überhaupt gesehen hat.
 */
export default function ActionPage() {
  const { token } = useParams<{ token: string }>();
  const [search] = useSearchParams();
  const presetRaw = search.get('a');
  const preset =
    presetRaw === 'yes' || presetRaw === 'no' || presetRaw === 'unclear' || presetRaw === 'late'
      ? presetRaw
      : null;

  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Die Antwort lief am Zwischenspeicher der App vorbei. Ohne Neuladen zeigte die
  // Übersicht nach „Zur App" noch den alten Stand — eben „offen", obwohl beantwortet.
  // `useContext` statt `useQueryClient`: Die Seite funktioniert auch ohne Anbieter.
  const queryClient = useContext(QueryClientContext);
  const refreshApp = () => void queryClient?.invalidateQueries();

  useEffect(() => {
    if (!token) return;
    let active = true;

    void (async () => {
      const { data, error } = await supabase.rpc('rpc_describe_action_token', {
        p_token: token,
      });

      if (!active) return;
      setInfo(error ? { status: 'error' } : ((data ?? { status: 'unknown' }) as TokenInfo));
    })();

    return () => {
      active = false;
    };
  }, [token]);

  async function submit(answer: Answer) {
    if (!token) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('rpc_answer_action_token', {
        p_token: token,
        p_answer: answer,
      });
      setResult(error ? { status: 'error' } : ((data ?? { status: 'error' }) as AnswerResult));
      if (!error) refreshApp();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardBody className="space-y-4 text-center">
          {result ? (
            <Outcome result={result} />
          ) : info === null ? (
            <p className="text-gray-600">Einen Moment …</p>
          ) : info.status === 'ok' && info.action === 'poll_vote' ? (
            <RescheduleHint summary={info.summary} />
          ) : info.status === 'ok' ? (
            <Question
              prompt={PROMPTS[info.action ?? ''] ?? DEFAULT_PROMPT}
              summary={info.summary}
              preset={preset}
              busy={busy}
              onAnswer={(answer) => void submit(answer)}
            />
          ) : (
            <Problem status={info.status} />
          )}

          <Link to="/" onClick={refreshApp} className={buttonClasses({ variant: 'ghost' })}>
            Zur App
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}

const ANSWER_ICON = { yes: Check, unclear: HelpCircle, no: X, late: Clock } as const;

function Question({
  prompt,
  summary,
  preset,
  busy,
  onAnswer,
}: {
  prompt: { title: string; answers: Answer[] };
  summary?: string;
  preset: Answer | null;
  busy: boolean;
  onAnswer: (answer: Answer) => void;
}) {
  return (
    <>
      <h1 className="text-lg font-bold text-gray-900">{prompt.title}</h1>
      {summary && <p className="text-gray-700">{summary}</p>}
      {preset && prompt.answers.includes(preset) && (
        <p className="text-sm text-gray-600">
          Du hast in der Nachricht „{ANSWER_LABEL[preset]}" gewählt — bitte bestätigen.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {prompt.answers.map((answer) => {
          const Icon = ANSWER_ICON[answer];
          const highlighted = preset === answer;
          return (
            <Button
              key={answer}
              variant={answer === 'yes' ? 'primary' : answer === 'no' ? 'danger' : undefined}
              aria-pressed={highlighted || undefined}
              className={highlighted ? 'ring-2 ring-offset-2 ring-primary' : undefined}
              disabled={busy}
              onClick={() => onAnswer(answer)}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {ANSWER_LABEL[answer]}
            </Button>
          );
        })}
      </div>
    </>
  );
}

function Outcome({ result }: { result: AnswerResult }) {
  if (result.status !== 'ok') {
    return <Problem status={result.status} />;
  }

  const answer = (result.answer ?? 'yes') as Answer;

  return (
    <>
      <h1 className="text-lg font-bold text-gray-900">Danke!</h1>
      <p className="text-gray-700">
        {OUTCOME_TEXT[answer] ?? OUTCOME_TEXT.yes}
        {result.summary && (
          <>
            <br />
            {result.summary}
          </>
        )}
      </p>
    </>
  );
}

function Problem({ status }: { status: string }) {
  const messages: Record<string, string> = {
    used: 'Über diesen Link wurde schon geantwortet. In der App kannst du deine Antwort weiterhin ändern.',
    expired: 'Dieser Link ist abgelaufen. Der Termin liegt inzwischen in der Vergangenheit.',
    gone: 'Diesen Termin gibt es nicht mehr.',
    closed: 'Die Rückmeldung ist für diese Mannschaft geschlossen. Bitte wende dich an deinen Mannschaftsführer.',
    unknown: 'Dieser Link ist ungültig. Vielleicht wurde er beim Kopieren abgeschnitten.',
    invalid_answer: 'Diese Antwort kennen wir nicht.',
    full: 'Leider sind schon alle Plätze vergeben.',
    cancelled: 'Dieser Termin fällt aus.',
    started: 'Der Termin hat schon begonnen — melde dich bitte direkt beim Trainer.',
    not_assigned: 'Du bist diesem Training nicht zugeordnet. Frag bitte beim Trainer nach.',
    not_supported: 'Diese Art von Link wird noch nicht unterstützt.',
  };

  return (
    <>
      <h1 className="text-lg font-bold text-gray-900">Das hat nicht geklappt</h1>
      <p className="text-gray-700">
        {messages[status] ?? 'Da ist etwas schiefgegangen. Bitte melde dich in der App an.'}
      </p>
    </>
  );
}

/**
 * Die Terminumfrage zur Spielverlegung hat bis zu drei Vorschläge — das passt nicht in
 * einen Knopf. Die Seite sagt, worum es geht, und schickt in die App, wo die Umfrage an
 * der Spielkarte steht.
 */
function RescheduleHint({ summary }: { summary?: string }) {
  return (
    <>
      <h1 className="text-lg font-bold text-gray-900">Terminumfrage zur Spielverlegung</h1>
      {summary && <p className="text-gray-700">{summary}</p>}
      <p className="text-sm text-gray-600">
        Für welche Vorschläge du kannst, trägst du in der App an der Spielkarte ein.
      </p>
      <Link to="/my-games" className={buttonClasses({ variant: 'primary' })}>
        Zur Terminumfrage
      </Link>
    </>
  );
}
