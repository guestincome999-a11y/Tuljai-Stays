import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '../auth/auth-context';

import { AnimatedWelcomeSplash } from './AnimatedWelcomeSplash';

// Run at module evaluation, before React's first content can auto-hide the native image.
void SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  console.warn('Could not retain native splash:', error);
});
// The existing 450 ms React entrance owns the transition. A second native fade
// would cover almost all of it on devices that restore authentication immediately.
SplashScreen.setOptions({ duration: 0, fade: false });

/** Lives above routes so fast auth restoration and deep links cannot cancel image loading. */
export function StartupSplash({ children }: { children: ReactNode }) {
  const { bootstrapComplete } = useAuth();
  const [entranceComplete, setEntranceComplete] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const onReady = useCallback(() => {
    // onLoad confirms decoding; onLayout confirms the replacement has a drawable area.
    SplashScreen.hide();
  }, []);
  const onEntranceComplete = useCallback(() => setEntranceComplete(true), []);
  useEffect(() => {
    if (bootstrapComplete && entranceComplete) setDismissed(true);
  }, [bootstrapComplete, entranceComplete]);
  const visible = !dismissed;

  return (
    <View style={styles.root}>
      {children}
      {visible ? (
        <View style={StyleSheet.absoluteFill}>
          <AnimatedWelcomeSplash onReady={onReady} onEntranceComplete={onEntranceComplete} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
