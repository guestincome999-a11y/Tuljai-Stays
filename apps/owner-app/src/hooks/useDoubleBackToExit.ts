import { useEffect, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';

const EXIT_WINDOW_MS = 2000;

/**
 * Overrides the Android hardware back button globally so it never navigates
 * to the previous screen/stack entry. First press shows a toast; a second
 * press within EXIT_WINDOW_MS exits the app. This applies on every screen,
 * not just the root, so in-app navigation must rely on on-screen back
 * controls / tab navigation rather than the hardware back button.
 *
 * No-op on iOS, which has no hardware back button.
 */
export function useDoubleBackToExit(message = 'Press back again to exit') {
  const lastBackPressRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const onBackPress = () => {
      const now = Date.now();

      if (now - lastBackPressRef.current < EXIT_WINDOW_MS) {
        BackHandler.exitApp();
        return true;
      }

      lastBackPressRef.current = now;
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [message]);
}
