import { useLocalSearchParams } from 'expo-router';

import { LoginScreen } from '../src/v2/features/auth/LoginScreen';
import { useGo } from '../src/v2/shell/navigation';

export default function LoginRoute() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { push, replace } = useGo();
  const target = typeof next === 'string' && next.startsWith('/') ? next : '/';

  return (
    <LoginScreen
      onOtpSent={(phoneNumber, devOtp) =>
        push(
          `/verify?phone=${encodeURIComponent(phoneNumber)}&devOtp=${encodeURIComponent(devOtp)}&next=${encodeURIComponent(target)}`,
        )
      }
      onSignedIn={(onboardingRequired) =>
        replace(onboardingRequired ? `/name?next=${encodeURIComponent(target)}` : target)
      }
    />
  );
}
