import { usePathname } from 'expo-router';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConnectivity } from '../connectivity/connectivity-context';
import { usePilgrimApp } from '../pilgrim-ui/PilgrimAppProvider';

import { canRestartForUpdate, createUpdateChecker } from './update-policy';

const checkForUpdates = createUpdateChecker(Updates);

/** Release builds download compatible UI updates without interrupting a stay or payment. */
export function PilgrimAppUpdates() {
  const { isOffline } = useConnectivity();
  const { t } = usePilgrimApp();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isStartupProcedureRunning, isChecking, isDownloading, isUpdatePending } =
    Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);
  const enabled = !__DEV__ && Platform.OS !== 'web' && Updates.isEnabled;

  useEffect(() => {
    if (
      !enabled ||
      isOffline ||
      isStartupProcedureRunning ||
      isChecking ||
      isDownloading ||
      isUpdatePending
    )
      return;
    const checkWhenActive = () => {
      if (AppState.currentState === 'active') void checkForUpdates();
    };
    checkWhenActive();
    const subscription = AppState.addEventListener('change', checkWhenActive);
    return () => subscription.remove();
  }, [enabled, isOffline, isStartupProcedureRunning, isChecking, isDownloading, isUpdatePending]);

  async function applyUpdate() {
    if (applying || AppState.currentState !== 'active' || !canRestartForUpdate(pathname)) return;
    setApplying(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setApplying(false);
      Alert.alert(
        t('Could not restart', 'पुन्हा सुरू करता आले नाही'),
        t(
          'Your update will be applied the next time you open the app.',
          'पुढच्या वेळी अॅप उघडल्यावर नवीन बदल लागू होतील.',
        ),
      );
    }
  }

  if (!enabled || !isUpdatePending || dismissed || !canRestartForUpdate(pathname)) return null;

  return (
    <View accessibilityLiveRegion="polite" style={[styles.banner, { bottom: insets.bottom + 80 }]}>
      <View style={styles.copy}>
        <Text style={styles.title}>{t('Update ready', 'नवीन बदल तयार आहेत')}</Text>
        <Text style={styles.body}>
          {t(
            'Restart to enjoy the latest improvements.',
            'नवीन सुधारणा वापरण्यासाठी अॅप पुन्हा सुरू करा.',
          )}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={applying}
          onPress={() => setDismissed(true)}
          style={styles.later}
        >
          <Text style={styles.laterText}>{t('Later', 'नंतर')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={applying}
          onPress={() => void applyUpdate()}
          style={styles.restart}
        >
          {applying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.restartText}>{t('Restart', 'पुन्हा सुरू करा')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  banner: {
    backgroundColor: '#FFF1DF',
    borderColor: '#F6C58E',
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    left: 16,
    padding: 16,
    position: 'absolute',
    right: 16,
    zIndex: 1000,
  },
  body: { color: '#7D5132', fontSize: 14, lineHeight: 20 },
  copy: { gap: 4 },
  later: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 },
  laterText: { color: '#8C3F10', fontWeight: '700' },
  restart: {
    alignItems: 'center',
    backgroundColor: '#A94D12',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 90,
    paddingHorizontal: 16,
  },
  restartText: { color: '#FFFFFF', fontWeight: '700' },
  title: { color: '#8C3F10', fontSize: 16, fontWeight: '700' },
});
