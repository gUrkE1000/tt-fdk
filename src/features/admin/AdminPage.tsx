import { Tabs } from '../../components/ui';
import CronStatusPanel from './CronStatusPanel';
import NotificationsLogPanel from './NotificationsLogPanel';
import SettingsPanel from './SettingsPanel';
import SyncRunsPanel from './SyncRunsPanel';

/**
 * Reiter „Betrieb" unter Verein (Aufgabe 8.4).
 *
 * Vier Fragen, die sonst nur mit psql zu beantworten waren: Läuft der Kalenderabgleich?
 * Kam die Benachrichtigung an? Laufen die Jobs? Und: Wie stelle ich das ein?
 *
 * Kein Werkzeugkasten zum Herumdrücken — außer „Nochmal versuchen" gibt es hier keine
 * Aktion. Der Betrieb soll sichtbar sein, nicht von Hand gefahren werden.
 */
export default function AdminPage() {
  return (
    <Tabs
      tabs={[
        { value: 'settings', label: 'Einstellungen', content: <SettingsPanel /> },
        { value: 'notifications', label: 'Benachrichtigungen', content: <NotificationsLogPanel /> },
        { value: 'sync', label: 'Kalenderabgleich', content: <SyncRunsPanel /> },
        { value: 'cron', label: 'Jobs', content: <CronStatusPanel /> },
      ]}
    />
  );
}
