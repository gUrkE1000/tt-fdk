import { PageHeader, Tabs } from '../../components/ui';
import Placeholder from '../../app/Placeholder';
import { useSession } from '../auth/session';
import ProfileTab from './ProfileTab';
import AbsencesTab from './AbsencesTab';

export default function ProfilePage() {
  const { profile } = useSession();

  if (!profile) return null;

  return (
    <div>
      <PageHeader title="Mein Profil" description={profile.full_name ?? undefined} />

      <Tabs
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
            content: <Placeholder title="Benachrichtigungen" task="4.3" />,
          },
          {
            value: 'auto-attendance',
            label: 'Automatische Trainingszusagen',
            content: <Placeholder title="Automatische Trainingszusagen" task="6.7" />,
          },
        ]}
      />
    </div>
  );
}
