import { useLocalSearchParams } from 'expo-router';

import { ExploreScreen } from '../../src/v2/features/explore/ExploreScreen';
import { useGo } from '../../src/v2/shell/navigation';

export default function ExploreRoute() {
  const { push } = useGo();
  const { saved } = useLocalSearchParams<{ saved?: string }>();

  return (
    <ExploreScreen
      initialSavedOnly={saved === '1'}
      key={saved === '1' ? 'saved' : 'all'}
      onOpenLodge={(lodgeId) => push(`/lodge/${lodgeId}`)}
    />
  );
}
