import { useSearchParams } from 'react-router-dom';
import { PageHeader, Tabs } from '../../components/ui';
import { useSession } from '../auth/session';
import ProfileTab from './ProfileTab';
import AbsencesTab from './AbsencesTab';
import NotificationsTab from './NotificationsTab';
import AutoAttendanceTab from './AutoAttendanceTab';

export default function ProfilePage() {
  const { profile } = useSession();
  const [search, setSearch] = useSearchParams();

  if (!profile) return null;

  return (
    <div>
      <PageHeader title="Mein Profil" description={profile.full_name ?? undefined} />

      <Tabs
        value={search.get('tab') ?? 'profile'}
        onValueChange={(value) => setSearch({ tab: value }, { replace: true })}
        tabs={[
          { value: 'profile', label: 'Profil', content: <ProfileTab profile={profile} /> },
          {
            value: 'absences',
            label: 'Abwesenheiten',
            content: <AbsencesTab profileId={profile.id} />,
          },
          {
            value: 'notifications',
            label: 'Benachrichtigungen',
            content: <NotificationsTab profile={profile} />,
          },
          {
            value: 'auto-attendance',
            label: 'Automatische Trainingszusagen',
            content: <AutoAttendanceTab profileId={profile.id} />,
          },
        ]}
      />
    </div>
  );
}
