import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing } from '@tuljai/ui';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useRouter } from 'expo-router';
import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

const LazyCameraScanner = lazy(async () => {
  const scannerModule = await import('./CameraQrScannerScreen');
  return { default: scannerModule.CameraQrScannerScreen };
});

export function QrScannerScreen() {
  const cameraModuleAvailable =
    Platform.OS === 'web' || requireOptionalNativeModule('ExpoCamera') !== null;

  if (!cameraModuleAvailable) {
    return <CameraUnavailable />;
  }

  return (
    <CameraErrorBoundary>
      <Suspense fallback={<CameraLoading />}>
        <LazyCameraScanner />
      </Suspense>
    </CameraErrorBoundary>
  );
}

function CameraLoading() {
  const theme = useTheme();

  return (
    <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
      <Text variant="bodyLarge">Preparing QR scanner...</Text>
    </View>
  );
}

function CameraUnavailable() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
      <MaterialCommunityIcons color={theme.colors.primary} name="camera-off-outline" size={56} />
      <Text style={styles.centerText} variant="headlineSmall">
        Camera update required
      </Text>
      <Text style={styles.centerText} variant="bodyMedium">
        This installed Expo runtime does not include the camera module. Update Expo Go or install a
        fresh owner-app development build, then reopen the app.
      </Text>
      <Button
        icon="history"
        mode="contained-tonal"
        onPress={() => router.push('/(app)/scan-history')}
      >
        Open Scan History
      </Button>
    </View>
  );
}

interface CameraErrorBoundaryProps {
  children: ReactNode;
}

interface CameraErrorBoundaryState {
  failed: boolean;
}

class CameraErrorBoundary extends Component<CameraErrorBoundaryProps, CameraErrorBoundaryState> {
  public state: CameraErrorBoundaryState = { failed: false };

  public static getDerivedStateFromError(): CameraErrorBoundaryState {
    return { failed: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('QR camera could not be loaded.', error, info.componentStack);
  }

  public render(): ReactNode {
    if (this.state.failed) {
      return <CameraUnavailable />;
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  centerText: {
    maxWidth: 460,
    textAlign: 'center',
  },
});
