import { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardBody, CardHeader, FormField, Input, useToast } from '../../components/ui';
import {
  changedPreferences,
  useNotificationPreferences,
  useSavePreferences,
} from '../notifications/api';
import NotificationMatrix, { stateOf } from '../notifications/NotificationMatrix';
import { parseEmailList } from './schemas';
import { useUpdateMyProfile, type Profile } from './api';

export default function NotificationsTab({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const preferences = useNotificationPreferences();
  const savePreferences = useSavePreferences();
  const updateProfile = useUpdateMyProfile();

  const [draft, setDraft] = useState<Record<string, { email: boolean; push: boolean }>>({});
  const [hours, setHours] = useState(String(profile.reminder_games_hours));
  const [copies, setCopies] = useState((profile.emails_copies ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => preferences.data ?? [], [preferences.data]);

  useEffect(() => {
    setDraft(
      Object.fromEntries(
        rows.map((row) => [row.type!, { email: row.email ?? true, push: row.push ?? true }]),
      ),
    );
  }, [rows]);

  async function onSave() {
    const parsedHours = Number(hours);
    if (!Number.isInteger(parsedHours) || parsedHours < 0 || parsedHours > 336) {
      toast('Der Vorlauf muss zwischen 0 und 336 Stunden liegen', 'error');
      return;
    }

    setSaving(true);
    try {
      await savePreferences.mutateAsync({
        profileId: profile.id,
        changes: changedPreferences(rows, draft),
      });

      await updateProfile.mutateAsync({
        id: profile.id,
        values: {
          reminder_games_hours: parsedHours,
          emails_copies: parseEmailList(copies),
        },
      });

      toast('Einstellungen gespeichert', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <Card>
        <CardHeader>
          <div>
            <h3 className="font-bold text-gray-900">Was du bekommen möchtest</h3>
            <p className="text-sm text-gray-500">
              Einige Nachrichten stehen nicht in dieser Liste: Wenn dich ein Mannschaftsführer
              auf- oder abstellt, bekommst du immer eine E-Mail.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <NotificationMatrix
            rows={rows}
            draft={draft}
            onChange={(type, next) => setDraft((current) => ({ ...current, [type]: next }))}
            onChangeAll={(channel, value) =>
              setDraft((current) =>
                Object.fromEntries(
                  rows.map((row) => {
                    const state = stateOf(row, current);
                    return [row.type!, { ...state, [channel]: value }];
                  }),
                ),
              )
            }
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-bold text-gray-900">Vorlauf und Kopien</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <FormField
            label="Wie viele Stunden vor einem Spiel möchtest du erinnert werden?"
            hint="0 schaltet die Erinnerung ab."
          >
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                max={336}
                value={hours}
                onChange={(event) => setHours(event.target.value)}
              />
            )}
          </FormField>

          <FormField
            label="E-Mail-Adressen für Kopien"
            hint="Kommagetrennt. An diese Adressen gehen alle Benachrichtigungen zusätzlich — hilfreich für Eltern."
          >
            {(p) => (
              <Input
                {...p}
                value={copies}
                onChange={(event) => setCopies(event.target.value)}
                placeholder="eltern@example.com"
              />
            )}
          </FormField>
        </CardBody>
      </Card>

      {/* Am unteren Rand klebend: die Matrix ist lang, und der Knopf soll nicht
          erst nach fünfzehn Zeilen Scrollen auftauchen. */}
      <div className="sticky bottom-16 z-10 flex justify-end sm:bottom-4">
        <Button variant="primary" loading={saving} onClick={() => void onSave()}>
          Speichern
        </Button>
      </div>
    </div>
  );
}
