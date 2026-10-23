import { ProfileScreen } from '../../src/v2/features/profile/ProfileScreen';
import { useGo } from '../../src/v2/shell/navigation';

export default function ProfileRoute() {
  const { push } = useGo();

  return (
    <ProfileScreen
      onOpenAnnouncements={() => push('/announcements')}
      onOpenLegal={(kind) => push(`/legal/${kind}`)}
      onOpenNotifications={() => push('/notifications')}
      onOpenSaved={() => push('/explore?saved=1')}
      onSignIn={() => push('/login?next=%2Fprofile')}
    />
  );
}
