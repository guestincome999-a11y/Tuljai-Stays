import { useLocalSearchParams } from 'expo-router';

import { OtpScreen } from '../src/v2/features/auth/OtpScreen';
import { useGo } from '../src/v2/shell/navigation';

export default function VerifyRoute() {
  const { devOtp, next, phone } = useLocalSearchParams<{
    devOtp?: string;
    next?: string;
    phone: string;
  }>();
  const { back, replace } = useGo();
  const target = typeof next === 'string' && next.startsWith('/') ? next : '/';

  return (
    <OtpScreen
      devOtp={devOtp ?? ''}
      phoneNumber={phone}
      onBack={back}
      onSignedIn={(onboardingRequired) =>
        replace(onboardingRequired ? `/name?next=${encodeURIComponent(target)}` : target)
      }
    />
  );
}
