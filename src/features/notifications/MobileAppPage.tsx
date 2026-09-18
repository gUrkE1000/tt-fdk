import { useMemo } from 'react';
import { Apple, Bell, CheckCircle2, Smartphone } from 'lucide-react';
import { Badge, Card, CardBody, PageHeader, Tabs } from '../../components/ui';
import { APP_URL } from '../../lib/supabaseClient';
import { detectPlatform, isInstalled } from '../../lib/pwa';

interface StepsProps {
  steps: string[];
}

function Steps({ steps }: StepsProps) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, index) => (
        <li key={step} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
            {index + 1}
          </span>
          <span className="text-sm text-gray-700">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * „App aufs Handy" (Aufgabe 8.2).
 *
 * Der Vereinsplaner ist eine Web-App, keine App aus dem Store. Das ist kein Mangel,
 * sondern der Grund, warum es ihn überhaupt gibt: kein Entwicklerkonto, keine
 * Freigabeverfahren, keine zwei getrennten Fassungen für iOS und Android. Nur muss man
 * es den Mitgliedern erklären — deshalb diese Seite.
 */
export default function MobileAppPage() {
  const platform = useMemo(
    () => detectPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent),
    [],
  );
  const installed = isInstalled();

  // Die Adresse, die die Mitglieder abtippen sollen — ohne Protokoll liest sie sich besser.
  const address = (APP_URL || window.location.origin).replace(/^https?:\/\//, '');

  return (
    <div>
      <PageHeader
        title="App aufs Handy"
        description="Der Vereinsplaner lässt sich wie eine App auf den Startbildschirm legen — ohne App Store."
      />

      {installed && (
        <Card className="mb-4">
          <CardBody className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-status-yes" aria-hidden="true" />
            <p className="text-sm text-gray-700">
              Du hast den Vereinsplaner bereits installiert — diese Seite läuft gerade als App.
            </p>
          </CardBody>
        </Card>
      )}

      <Card className="mb-4">
        <CardBody className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Adresse</p>
          <p className="text-lg font-bold text-gray-900">{address}</p>
          <p className="text-sm text-gray-600">
            Diese Adresse im Browser des Handys öffnen, anmelden, und dann der Anleitung unten
            folgen.
          </p>
        </CardBody>
      </Card>

      <Tabs
        defaultValue={platform === 'android' ? 'android' : 'ios'}
        tabs={[
          {
            value: 'ios',
            label: 'iPhone und iPad',
            content: (
              <Card>
                <CardBody className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Apple className="h-5 w-5 text-gray-500" aria-hidden="true" />
                    <h3 className="font-bold text-gray-900">Installation für iOS</h3>
                    {platform === 'ios' && <Badge tone="primary">dein Gerät</Badge>}
                  </div>

                  <Steps
                    steps={[
                      `${address} in Safari öffnen — nicht in Chrome oder Firefox, dort fehlt der Eintrag.`,
                      'Anmelden.',
                      'Unten auf das Teilen-Symbol tippen (Quadrat mit Pfeil nach oben).',
                      'Im Menü „Zum Home-Bildschirm" wählen.',
                      'Oben rechts auf „Hinzufügen" tippen.',
                      'Die App vom Startbildschirm öffnen und auf das Glocken-Symbol tippen, um Mitteilungen zu erlauben.',
                    ]}
                  />

                  <p className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                    <span>
                      Mitteilungen gibt es auf dem iPhone nur, wenn der Vereinsplaner vorher auf dem
                      Startbildschirm liegt. Im Safari-Fenster bleibt die Glocke wirkungslos — das
                      ist eine Einschränkung von iOS, keine der Anwendung.
                    </span>
                  </p>
                </CardBody>
              </Card>
            ),
          },
          {
            value: 'android',
            label: 'Android',
            content: (
              <Card>
                <CardBody className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-gray-500" aria-hidden="true" />
                    <h3 className="font-bold text-gray-900">Installation für Android</h3>
                    {platform === 'android' && <Badge tone="primary">dein Gerät</Badge>}
                  </div>

                  <Steps
                    steps={[
                      `${address} in Chrome öffnen.`,
                      'Anmelden.',
                      'Oben rechts auf die drei Punkte tippen.',
                      '„App installieren" beziehungsweise „Zum Startbildschirm hinzufügen" wählen und bestätigen.',
                      'Die App vom Startbildschirm öffnen und auf das Glocken-Symbol tippen, um Mitteilungen zu erlauben.',
                    ]}
                  />

                  <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                    Chrome bietet die Installation oft auch von selbst als Leiste am unteren Rand an.
                    Erscheint gar nichts, hilft ein Neuladen der Seite.
                  </p>
                </CardBody>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
