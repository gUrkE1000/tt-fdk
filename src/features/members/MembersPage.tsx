import { useSearchParams } from 'react-router-dom';
import { PageHeader, Tabs } from '../../components/ui';
import MembersTab from './MembersTab';
import GroupsTab from './GroupsTab';

export default function MembersPage() {
  const [params] = useSearchParams();

  return (
    <div>
      <PageHeader
        title="Mitglieder"
        description="Anlegen, freischalten, Rollen und Ränge pflegen."
      />

      <Tabs
        tabs={[
          {
            value: 'members',
            label: 'Mitglieder',
            // Neu aufgebaut, wenn „Bearbeiten" aus der Suche einen anderen Namen mitbringt.
            content: <MembersTab key={params.get('q') ?? ''} />,
          },
          { value: 'groups', label: 'Gruppen', content: <GroupsTab /> },
        ]}
      />
    </div>
  );
}
