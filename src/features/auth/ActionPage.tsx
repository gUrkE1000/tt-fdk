import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Check, HelpCircle, X } from 'lucide-react';
import { Button, buttonClasses, Card, CardBody } from '../../components/ui';
import { supabase } from '../../lib/supabaseClient';

type Answer = 'yes' | 'no' | 'unclear';

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
};

/**
 * Die Seite hinter dem Link aus einer Benachrichtigung.
 *
 * Sie funktioniert ohne Anmeldung — das ist der Unterschied zwischen einer
 * Rückmeldequote von fünfzig und von neunzig Prozent. Was der Token erlaubt, ist eng
 * gefasst: eine Antwort, zu einem Termin, einmal.
 *
 * Kommt die Antwort schon in der Adresse mit (`?a=yes`, so stehen es die Knöpfe in der
 * E-Mail), wird sie sofort gespeichert. Sonst fragt die Seite nach.
 */
export default function ActionPage() {
  const { token } = useParams<{ token: string }>();
  const [search] = useSearchParams();
  const preset = search.get('a') as Answer | null;

  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;

    void (async () => {
      const { data, error } = await supabase.rpc('rpc_describe_action_token', {
        p_token: token,
      });

      if (!active) return;
      if (error) {
        setInfo({ status: 'error' });
        return;
      }

      const described = (data ?? { status: 'unknown' }) as TokenInfo;
      setInfo(described);

      // Die Antwort aus der Adresse gilt sofort — der Klick in der E-Mail war die
      // Entscheidung, eine zweite Bestätigung wäre nur eine Hürde.
      if (described.status === 'ok' && preset && ['yes', 'no', 'unclear'].includes(preset)) {
        await submit(preset);
      }
    })();

    return () => {
      active = false;
    };
    // Absichtlich nur am Token hängend: ein Wechsel von `preset` soll nicht erneut
    // speichern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          ) : info.status === 'ok' ? (
            <>
              <h1 className="text-lg font-bold text-gray-900">Kannst du spielen?</h1>
              <p className="text-gray-700">{info.summary}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" disabled={busy} onClick={() => void submit('yes')}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Zusage
                </Button>
                <Button disabled={busy} onClick={() => void submit('unclear')}>
                  <HelpCircle className="h-4 w-4" aria-hidden="true" />
                  Unsicher
                </Button>
                <Button variant="danger" disabled={busy} onClick={() => void submit('no')}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Absage
                </Button>
              </div>
            </>
          ) : (
            <Problem status={info.status} />
          )}

          <Link to="/" className={buttonClasses({ variant: 'ghost' })}>
            Zur App
          </Link>
        </CardBody>
      </Card>
    </div>
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
        Deine {ANSWER_LABEL[answer]} ist gespeichert.
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
