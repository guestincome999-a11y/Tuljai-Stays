import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { CheckInResponse } from '@tuljai/types';
import { radius, spacing } from '@tuljai/ui';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Switch, Text, useTheme } from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useConnectivity } from '../../../connectivity/connectivity-context';
import { getOrCreateDeviceId } from '../../../device/device-identity';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import { scanQrCode } from '../api/checkin-api';
import { useReceptionMode } from '../hooks/useReceptionMode';

type ScanOutcome =
  | { message: string; response: CheckInResponse; type: 'SUCCESS' }
  | { message: string; type: 'ERROR' };

export function CameraQrScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const assignedLodges = useAssignedLodges();
  const { isOffline } = useConnectivity();
  const receptionMode = useReceptionMode();
  const router = useRouter();
  const theme = useTheme();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const lastPayloadRef = useRef<string | null>(null);

  async function handleScanned(result: BarcodeScanningResult) {
    const qrPayload = result.data;

    if (isProcessing || !qrPayload || lastPayloadRef.current === qrPayload || outcome?.type) {
      return;
    }

    if (isOffline) {
      setOutcome({ message: 'Internet connection required to validate QR.', type: 'ERROR' });
      return;
    }

    lastPayloadRef.current = qrPayload;
    setIsProcessing(true);
    setOutcome(null);

    try {
      const deviceId = await getOrCreateDeviceId();
      const response = await scanQrCode({ deviceId, qrPayload });
      setOutcome({ message: 'Check-in Successful', response, type: 'SUCCESS' });
    } catch (error) {
      setOutcome({ message: getScanErrorMessage(error), type: 'ERROR' });
    } finally {
      setIsProcessing(false);
    }
  }

  function resetScanner() {
    lastPayloadRef.current = null;
    setOutcome(null);
  }

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text variant="bodyLarge">Preparing camera permissions.</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <MaterialCommunityIcons color={theme.colors.primary} name="camera-off-outline" size={48} />
        <Text style={styles.centerText} variant="headlineSmall">
          Camera permission needed
        </Text>
        <Text style={styles.centerText} variant="bodyMedium">
          Allow camera access to scan pilgrim QR passes.
        </Text>
        <Button mode="contained" onPress={() => void requestPermission()}>
          Allow Camera
        </Button>
      </View>
    );
  }

  const selectedLodgeName = assignedLodges.selectedLodge?.name ?? 'No lodge selected';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <CameraView
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        enableTorch={torchEnabled}
        facing={facing}
        style={styles.camera}
        onBarcodeScanned={
          isProcessing || outcome?.type
            ? undefined
            : (result: BarcodeScanningResult) => {
                void handleScanned(result);
              }
        }
      >
        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.lightText} variant="headlineSmall">
                Scan Guest QR
              </Text>
              <Text style={styles.lightText} variant="bodyMedium">
                {selectedLodgeName}
              </Text>
            </View>
            <View style={styles.receptionToggle}>
              <Text style={styles.lightText} variant="labelLarge">
                Reception
              </Text>
              <Switch value={receptionMode.enabled} onValueChange={receptionMode.setEnabled} />
            </View>
          </View>

          <View style={[styles.scanFrame, receptionMode.enabled ? styles.scanFrameLarge : null]}>
            <View style={[styles.scanLine, { backgroundColor: theme.colors.primary }]} />
          </View>

          <Text
            style={styles.guideText}
            variant={receptionMode.enabled ? 'titleLarge' : 'bodyLarge'}
          >
            Align QR inside the frame
          </Text>

          <View style={styles.controls}>
            <Button
              accessibilityLabel="Toggle flash"
              accessibilityHint="Turns the camera flash on or off for QR scanning."
              mode="contained-tonal"
              onPress={() => setTorchEnabled((current) => !current)}
            >
              Flash {torchEnabled ? 'On' : 'Off'}
            </Button>
            <Button
              accessibilityLabel="Switch camera"
              accessibilityHint="Switches between front and back camera."
              mode="contained-tonal"
              onPress={() => setFacing((current) => (current === 'back' ? 'front' : 'back'))}
            >
              Switch
            </Button>
            <Button
              accessibilityHint="Opens recent QR scan attempts and results."
              accessibilityLabel="Open QR scan history"
              mode="contained-tonal"
              onPress={() => router.push('/(app)/scan-history')}
            >
              History
            </Button>
          </View>
        </View>
      </CameraView>

      <View style={styles.resultPanel}>
        {isOffline ? (
          <FormErrorBanner message="Internet connection required to validate QR." />
        ) : null}
        {isProcessing ? <Text variant="titleMedium">Validating QR securely...</Text> : null}
        {outcome?.type === 'SUCCESS' ? (
          <Card mode="contained" style={styles.card}>
            <Card.Content style={styles.resultContent}>
              <Text style={{ color: theme.colors.primary }} variant="headlineSmall">
                {outcome.message}
              </Text>
              <Text variant="titleMedium">{outcome.response.booking.guestName}</Text>
              <Text variant="bodyMedium">{outcome.response.booking.bookingCode}</Text>
              <Text variant="bodyMedium">
                Room: {outcome.response.register.roomNumber ?? 'Assigned'}
              </Text>
              <Text variant="bodyMedium">Guests: {outcome.response.register.totalGuests}</Text>
              <Text variant="bodyMedium">
                Check-in: {new Date(outcome.response.register.checkInAt).toLocaleString('en-IN')}
              </Text>
              <View style={styles.resultActions}>
                <Button
                  accessibilityHint="Opens the guest register unlocked by this QR check-in."
                  accessibilityLabel="Open guest register after successful check-in"
                  mode="contained"
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/register/[id]',
                      params: { id: outcome.response.register.id },
                    })
                  }
                >
                  Open Guest Register
                </Button>
                <Button
                  accessibilityHint="Clears this result and scans another pilgrim QR pass."
                  accessibilityLabel="Scan next guest QR"
                  mode="contained-tonal"
                  onPress={resetScanner}
                >
                  Scan Next Guest
                </Button>
              </View>
            </Card.Content>
          </Card>
        ) : null}
        {outcome?.type === 'ERROR' ? (
          <Card mode="outlined" style={styles.card}>
            <Card.Content style={styles.resultContent}>
              <Text style={{ color: theme.colors.error }} variant="titleLarge">
                {outcome.message}
              </Text>
              <Button
                accessibilityHint="Clears this failed scan and starts scanning again."
                accessibilityLabel="Scan QR again"
                mode="contained-tonal"
                onPress={resetScanner}
              >
                Scan Again
              </Button>
            </Card.Content>
          </Card>
        ) : null}
      </View>
    </View>
  );
}

function getScanErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('used')) {
    return 'QR already used. Guest has already checked in.';
  }

  if (message.includes('expired')) {
    return 'QR expired. Ask the pilgrim to refresh the QR from their app.';
  }

  if (message.includes('cannot scan') || message.includes('unauthorized')) {
    return 'This booking belongs to another lodge.';
  }

  if (message.includes('status')) {
    return 'Booking is not ready for QR check-in.';
  }

  return 'Invalid QR. Please ask the pilgrim to reopen their QR.';
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  card: {
    borderRadius: radius.sm,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  centerText: {
    textAlign: 'center',
  },
  container: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  guideText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  lightText: {
    color: '#FFFFFF',
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  receptionToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  resultActions: {
    gap: spacing.sm,
  },
  resultContent: {
    gap: spacing.md,
  },
  resultPanel: {
    gap: spacing.md,
    padding: spacing.md,
  },
  scanFrame: {
    alignSelf: 'center',
    borderColor: '#FFFFFF',
    borderRadius: radius.sm,
    borderWidth: 4,
    height: 240,
    justifyContent: 'center',
    width: 240,
  },
  scanFrameLarge: {
    height: 300,
    width: 300,
  },
  scanLine: {
    height: 3,
    width: '100%',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
