import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

import { extraStrings } from '../i18n/extraStrings';
import { useLang } from '../i18n/language';
import { useToast } from '../ui/Toast';

const EXIT_WINDOW_MS = 2000;

/** Android back goes to the previous screen; on the first screen it asks twice before exiting. */
export function useAppBack(): void {
  const router = useRouter();
  const { t } = useLang();
  const toast = useToast();
  const lastPress = useRef(0);
  const routerRef = useRef(router);
  routerRef.current = router;
  const message = t(extraStrings.backToExit);
  const messageRef = useRef(message);
  messageRef.current = message;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (routerRef.current.canGoBack()) {
        routerRef.current.back();
        return true;
      }
      const now = Date.now();
      if (now - lastPress.current < EXIT_WINDOW_MS) {
        BackHandler.exitApp();
        return true;
      }
      lastPress.current = now;
      toastRef.current(messageRef.current);
      return true;
    });
    return () => subscription.remove();
  }, []);
}
