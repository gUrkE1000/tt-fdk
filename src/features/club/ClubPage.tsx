import { PageHeader, Tabs } from '../../components/ui';
import Placeholder from '../../app/Placeholder';
import ClubDataTab from './ClubDataTab';
import ClubOverviewTab from './ClubOverviewTab';

export default function ClubPage() {
  return (
    <div>
      <PageHeader title="Verein" description="Vereinsdaten, Ämter und Übersicht." />

      <Tabs
        tabs={[
          { value: 'data', label: 'Daten', content: <ClubDataTab /> },
          {
            value: 'offices',
            label: 'Ämter',
            content: <Placeholder title="Ämter" task="9.6" />,
          },
          {
            value: 'news',
            label: 'Neuigkeiten',
            content: <Placeholder title="Vereinsneuigkeiten" task="9.4" />,
          },
          {
            value: 'files',
            label: 'Dateien',
            content: <Placeholder title="Vereinsdateien" task="9.5" />,
          },
          { value: 'overview', label: 'Übersicht', content: <ClubOverviewTab /> },
        ]}
      />
    </div>
  );
}
