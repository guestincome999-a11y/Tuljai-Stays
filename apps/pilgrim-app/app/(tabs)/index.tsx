import { HomeScreen } from '../../src/v2/features/home/HomeScreen';
import { useGo } from '../../src/v2/shell/navigation';

export default function HomeRoute() {
  const { push } = useGo();

  return (
    <HomeScreen
      onOpenAnnouncements={() => push('/announcements')}
      onOpenExplore={() => push('/explore')}
      onOpenLodge={(lodgeId) => push(`/lodge/${lodgeId}`)}
    />
  );
}
