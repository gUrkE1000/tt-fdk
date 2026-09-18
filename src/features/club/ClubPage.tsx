import { PageHeader, Tabs } from '../../components/ui';
import Placeholder from '../../app/Placeholder';
import ClubDataTab from './ClubDataTab';
import ClubOverviewTab from './ClubOverviewTab';
import AdminPage from '../admin/AdminPage';
import ClubRolesTab from './ClubRolesTab';

export default function ClubPage() {
  return (
    <div>
      <PageHeader title="Verein" description="Vereinsdaten, Ämter und Übersicht." />

      <Tabs
        tabs={[
          { value: 'data', label: 'Daten', content: <ClubDataTab /> },
          { value: 'offices', label: 'Ämter', content: <ClubRolesTab /> },
          {
            value: 'news',
            label: 'Neuigkeiten',
            content: <Placeholder title="Vereinsneuigkeiten" task="9.3" />,
          },
          {
            value: 'files',
            label: 'Dateien',
            content: <Placeholder title="Vereinsdateien" task="9.4" />,
          },
          { value: 'overview', label: 'Übersicht', content: <ClubOverviewTab /> },
          { value: 'operations', label: 'Betrieb', content: <AdminPage /> },
        ]}
      />
    </div>
  );
}
