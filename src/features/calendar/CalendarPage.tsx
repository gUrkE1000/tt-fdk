import { PageHeader, Tabs } from '../../components/ui';
import { useSession } from '../auth/session';
import PlanningTab from './PlanningTab';
import AbsencesTab from './AbsencesTab';

export default function CalendarPage() {
  const { role } = useSession();
  const mayPlan = role === 'admin' || role === 'trainer' || role === 'team_leader';

  return (
    <div>
      <PageHeader title="Kalender" description="Alle Termine des Vereins auf einen Blick." />

      <Tabs
        tabs={[
          { value: 'planning', label: 'Planung', content: <PlanningTab /> },
          ...(mayPlan
            ? [
                {
                  value: 'absences',
                  label: 'Abwesenheiten',
                  content: <AbsencesTab canManage={role === 'admin'} />,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
