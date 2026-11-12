import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { lookupOwnerBookingQr } from '../api/owner-bookings-api';

export function BookingSearchScanner({
  lodgeId,
  onClose,
  onFound,
}: {
  lodgeId: string;
  onClose: () => void;
  onFound: (bookingCode: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const theme = useTheme();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function scanned(result: BarcodeScanningResult) {
    if (locked.current) return;
    locked.current = true;
    setError(null);
    setBusy(true);
    try {
      if (!/^tjsqr\.v[12]\./.test(result.data) || result.data.length > 1800) {
        throw new Error('Scan a Tuljai Stays booking QR.');
      }
      const booking = await lookupOwnerBookingQr(result.data, lodgeId);
      if (mounted.current) onFound(booking.bookingCode);
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error ? cause.message : 'Could not find this booking. Try again.',
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="titleLarge">Scan to search</Text>
            <Text variant="bodySmall">
              Only fills the booking code. No check-in or payment changes.
            </Text>
          </View>
          <IconButton
            icon="close"
            accessibilityLabel="Close booking search scanner"
            onPress={onClose}
          />
        </View>
        {!permission ? (
          <ActivityIndicator />
        ) : !permission.granted ? (
          <View style={styles.permission}>
            <Text variant="bodyLarge">Allow camera access to scan a booking QR.</Text>
            {permission.canAskAgain ? (
              <Button mode="contained" onPress={() => void requestPermission()}>
                Allow camera
              </Button>
            ) : (
              <Button mode="contained" onPress={() => void Linking.openSettings()}>
                Open settings
              </Button>
            )}
            <Button onPress={onClose}>Return to booking search</Button>
          </View>
        ) : (
          <View style={styles.preview}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={busy || error ? undefined : (result) => void scanned(result)}
            />
            <View pointerEvents="none" style={styles.frame} />
          </View>
        )}
        {busy ? (
          <View style={styles.footer}>
            <ActivityIndicator />
            <Text>Finding booking…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.footer}>
            <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>
              {error}
            </Text>
            <Button
              mode="contained"
              onPress={() => {
                locked.current = false;
                setError(null);
              }}
            >
              Scan again
            </Button>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  permission: { flex: 1, justifyContent: 'center', gap: 20 },
  preview: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: { width: '75%', aspectRatio: 1, borderWidth: 3, borderRadius: 20, borderColor: '#ffffff' },
  footer: { alignItems: 'center', gap: 12 },
});
