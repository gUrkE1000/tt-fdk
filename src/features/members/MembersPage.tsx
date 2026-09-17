import { PageHeader, Tabs } from '../../components/ui';
import MembersTab from './MembersTab';
import GroupsTab from './GroupsTab';

export default function MembersPage() {
  return (
    <div>
      <PageHeader
        title="Mitglieder"
        description="Anlegen, freischalten, Rollen und Ränge pflegen."
      />

      <Tabs
        tabs={[
          { value: 'members', label: 'Mitglieder', content: <MembersTab /> },
          { value: 'groups', label: 'Gruppen', content: <GroupsTab /> },
        ]}
      />
    </div>
  );
}
