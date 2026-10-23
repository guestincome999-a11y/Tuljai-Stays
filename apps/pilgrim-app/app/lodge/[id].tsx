import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../src/v2/core/auth';
import { LodgeDetailScreen } from '../../src/v2/features/lodges/LodgeDetailScreen';
import { useGo } from '../../src/v2/shell/navigation';

export default function LodgeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { back, push } = useGo();
  const auth = useAuth();

  return (
    <LodgeDetailScreen
      lodgeId={id}
      onBack={back}
      onCheckAvailability={(lodgeId) =>
        push(
          auth.signedIn
            ? `/book/${lodgeId}`
            : `/login?next=${encodeURIComponent(`/book/${lodgeId}`)}`,
        )
      }
    />
  );
}
