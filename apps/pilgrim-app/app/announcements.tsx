import { AnnouncementsScreen } from '../src/v2/features/announcements/AnnouncementsScreen';
import { useGo } from '../src/v2/shell/navigation';

export default function AnnouncementsRoute() {
  const { back } = useGo();

  return <AnnouncementsScreen onBack={back} />;
}
