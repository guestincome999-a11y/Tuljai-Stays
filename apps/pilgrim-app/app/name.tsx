import { useLocalSearchParams } from 'expo-router';

import { NameScreen } from '../src/v2/features/auth/NameScreen';
import { useGo } from '../src/v2/shell/navigation';

export default function NameRoute() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { replace } = useGo();
  const target = typeof next === 'string' && next.startsWith('/') ? next : '/';

  return <NameScreen onDone={() => replace(target)} />;
}
