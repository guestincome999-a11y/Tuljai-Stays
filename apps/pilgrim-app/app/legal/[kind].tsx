import { useLocalSearchParams } from 'expo-router';

import { LegalScreen } from '../../src/v2/features/legal/LegalScreen';
import { useGo } from '../../src/v2/shell/navigation';

export default function LegalRoute() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const { back } = useGo();

  return <LegalScreen kind={kind === 'privacy' ? 'privacy' : 'terms'} onBack={back} />;
}
