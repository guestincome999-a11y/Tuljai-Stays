import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '../design/theme';
import { radius, space } from '../design/tokens';

import { Text } from './Text';

const TOAST_MS = 3500;

const ToastContext = createContext<(message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: string) => {
    setMessage(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 96 }]}>
          <Animated.View
            entering={FadeInDown.duration(180)}
            exiting={FadeOutDown.duration(160)}
            style={[styles.toast, { backgroundColor: colors.ink }]}
          >
            <Text color="surface" variant="label">
              {message}
            </Text>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    left: 0,
    paddingHorizontal: space.xl,
    position: 'absolute',
    right: 0,
  },
  toast: { borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md },
});
