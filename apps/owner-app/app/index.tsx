import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '../src/auth/auth-context';
import { OwnerSplashScreen } from '../src/components/OwnerSplashScreen';

export default function BootstrapScreen() {
  const { bootstrapComplete, hasOwnerAccess, isAuthenticated } = useAuth();
  const [minimumDisplayComplete, setMinimumDisplayComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumDisplayComplete(true), 2200);
    return () => clearTimeout(timer);
  }, []);

  if (!bootstrapComplete || !minimumDisplayComplete) {
    return <OwnerSplashScreen />;
  }

  return (
    <Redirect
      href={
        isAuthenticated && hasOwnerAccess ? '/(app)/dashboard' : '/(auth)/login'
      }
    />
  );
}
