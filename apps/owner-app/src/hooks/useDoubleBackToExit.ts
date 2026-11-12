import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';

const EXIT_WINDOW_MS = 2000;

/**
 * Protects Home from accidental exits. All other screens retain normal
 * navigation back behavior without an exit prompt.
 *
 * No-op on iOS, which has no hardware back button.
 */
export function useDoubleBackToExit(message = 'Press back again to exit') {
  const pathname = usePathname();
  const lastBackPressRef = useRef(0);

  useEffect(() => {
    lastBackPressRef.current = 0;
    if (Platform.OS !== 'android' || pathname !== '/dashboard') {
      return undefined;
    }

    const onBackPress = () => {
      const now = Date.now();

      if (lastBackPressRef.current > 0 && now - lastBackPressRef.current < EXIT_WINDOW_MS) {
        BackHandler.exitApp();
        return true;
      }

      lastBackPressRef.current = now;
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [message, pathname]);
}
