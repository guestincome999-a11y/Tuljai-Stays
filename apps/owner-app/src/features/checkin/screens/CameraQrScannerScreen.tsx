import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Booking, OwnerBookingSummary, PaymentStatus } from '@tuljai/types';
import { colors } from '@tuljai/ui';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Switch, Text, useTheme } from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useConnectivity } from '../../../connectivity/connectivity-context';
import { radius, spacing } from '../../../owner-ui/theme';
import { useRealtime } from '../../../realtime/realtime-provider';
import { getCachedScanBooking, getOwnerBooking } from '../../bookings/api/owner-bookings-api';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import { collectPayAtLodge } from '../api/checkin-api';
import { useCheckinSync } from '../CheckinSyncProvider';
import { useReceptionMode } from '../hooks/useReceptionMode';
import { isPending, ScanGate, type RecognizedQr, type RecognitionStatus } from '../scan-operation';

type ScanOutcome = { status: RecognitionStatus; qr: RecognizedQr | null };

export function CameraQrScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const assignedLodges = useAssignedLodges();
  const { isOffline } = useConnectivity();
  const receptionMode = useReceptionMode();
  const router = useRouter();
  const theme = useTheme();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const sync = useCheckinSync();
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bookingDetails, setBookingDetails] = useState<OwnerBookingSummary | null>(null);
  const [detailsUnavailable, setDetailsUnavailable] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const collecting = useRef(false);
  const collectionSubmitted = useRef(false);
  const realtime = useRealtime();
  const gate = useRef(new ScanGate());
  const operation = outcome?.qr ? sync.queue?.get(outcome.qr.key) : undefined;
  const response = operation?.response;
  const cached = outcome?.qr ? getCachedScanBooking(outcome.qr.bookingId) : undefined;
  const booking = response?.booking ?? bookingDetails ?? cached;

  function handleScanned(result: BarcodeScanningResult) {
    const recognized = gate.current.capture(result.data);
    if (!recognized) return;
    const duplicate = recognized.qr && sync.queue?.get(recognized.qr.key);
    setOutcome({
      ...recognized,
      status: duplicate ? 'QR_ALREADY_SCANNED_LOCALLY' : recognized.status,
    });
  }

  // The result commits first. Yield a paint before storage, device lookup or HTTP.
  // Do not cancel on navigation: the app-level queue owns work after this point.
  useEffect(() => {
    if (!outcome?.qr || !sync.queue || !sync.ready) return;
    const qr = outcome.qr;
    const queue = sync.queue;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        void queue.enqueue(qr).catch((error: unknown) => {
          setSaveError(
            error instanceof Error ? error.message : 'Could not save scan. Please retry.',
          );
        });
      }),
    );
  }, [outcome, sync.queue, sync.ready]);

  // Payment guidance must not wait for the check-in request to finish.
  // Use saved details immediately; fetch missing details only after the result paints.
  useEffect(() => {
    if (!outcome?.qr || !outcome.qr.bookingId || cached || isOffline) return;
    const bookingId = outcome.qr.bookingId;
    let disposed = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (disposed) return;
        void getOwnerBooking(bookingId)
          .then((details) => {
            if (!disposed) setBookingDetails(details);
          })
          .catch(() => {
            if (!disposed) setDetailsUnavailable(true);
          });
      }),
    );
    return () => {
      disposed = true;
    };
  }, [outcome, cached, isOffline]);

  function resetScanner() {
    if (collecting.current) return;
    gate.current.reset();
    setSaveError(null);
    setBookingDetails(null);
    setDetailsUnavailable(false);
    setCollectionError(null);
    setOutcome(null);
  }

  function confirmCollected() {
    const confirmed = response?.booking;
    const amount = confirmed?.balanceAmount ?? confirmed?.totalAmount;
    if (
      collecting.current ||
      isOffline ||
      !confirmed ||
      confirmed.paymentStatus !== 'PAY_AT_LODGE' ||
      confirmed.status !== 'CHECKED_IN' ||
      confirmed.payAtLodgeCollectedAt ||
      !amount ||
      Number(amount) <= 0
    )
      return;
    collecting.current = true;
    collectionSubmitted.current = false;
    const cancel = () => {
      collecting.current = false;
    };
    const submit = () => {
      if (!collecting.current || collectionSubmitted.current) return;
      collectionSubmitted.current = true;
      setIsCollecting(true);
      setCollectionError(null);
      void collectPayAtLodge(confirmed.id, amount)
        .then((updated) => {
          sync.queue?.updateConfirmedBooking(updated);
          realtime.refreshBookingData();
        })
        .catch((error: unknown) => {
          setCollectionError(
            error instanceof Error
              ? error.message
              : 'Payment could not be marked collected. Please retry.',
          );
        })
        .finally(() => {
          collecting.current = false;
          setIsCollecting(false);
        });
    };
    Alert.alert(
      'Payment collected?',
      `Have you received ${formatAmount(amount)} for ${confirmed.bookingCode}?`,
      [
        { text: 'No', style: 'cancel', onPress: cancel },
        {
          text: 'Yes',
          onPress: () =>
            Alert.alert(
              'Confirm collected payment',
              `Mark ${formatAmount(amount)} as collected at the lodge for ${confirmed.bookingCode}?`,
              [
                { text: 'No', style: 'cancel', onPress: cancel },
                { text: 'Yes', onPress: submit },
              ],
              { cancelable: false },
            ),
        },
      ],
      { cancelable: false },
    );
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
      {!outcome ? (
        <CameraView
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          enableTorch={torchEnabled}
          facing={facing}
          style={styles.camera}
          onBarcodeScanned={sync.ready ? handleScanned : undefined}
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
      ) : null}

      <ScrollView
        contentContainerStyle={styles.resultPanel}
        style={outcome ? { flex: 1 } : { flexGrow: 0 }}
      >
        {sync.error ? <FormErrorBanner message={sync.error} /> : null}
        {!sync.ready && !sync.error ? <Text>Restoring pending scans...</Text> : null}
        {!outcome && isOffline ? <Text>Offline scans will wait for verification.</Text> : null}
        {outcome ? (
          <Card mode="contained" style={styles.card}>
            <Card.Content style={styles.resultContent}>
              <Text
                style={{
                  color:
                    outcome.status === 'QR_INVALID' ? theme.colors.error : theme.colors.primary,
                }}
                accessibilityLiveRegion="polite"
                variant="headlineSmall"
              >
                {outcome.status === 'QR_INVALID'
                  ? 'Invalid QR format'
                  : operation?.status === 'CHECKED_IN'
                    ? 'Check-In Successful'
                    : operation?.status === 'ALREADY_CHECKED_IN'
                      ? 'Already Checked In'
                      : 'QR Scanned'}
              </Text>
              {outcome.qr ? (
                <>
                  {booking ? (
                    <PaymentGuidanceBanner booking={booking} />
                  ) : (
                    <Text variant="bodyMedium">
                      {isOffline
                        ? 'Payment details unavailable offline. Pending verification.'
                        : detailsUnavailable
                          ? 'Payment details could not be loaded. Open the booking to verify payment.'
                          : 'Loading payment details...'}
                    </Text>
                  )}
                  {response?.booking.paymentStatus === 'PAY_AT_LODGE' ? (
                    <Button
                      mode="contained"
                      icon={response.booking.payAtLodgeCollectedAt ? 'check' : 'cash-check'}
                      disabled={
                        isOffline ||
                        isCollecting ||
                        Boolean(response.booking.payAtLodgeCollectedAt) ||
                        response.booking.status !== 'CHECKED_IN' ||
                        Number(
                          response.booking.balanceAmount ?? response.booking.totalAmount ?? 0,
                        ) <= 0
                      }
                      loading={isCollecting}
                      onPress={confirmCollected}
                    >
                      Collected
                    </Button>
                  ) : null}
                  {collectionError ? <FormErrorBanner message={collectionError} /> : null}
                  {cached && !bookingDetails && !response ? (
                    <Text variant="bodySmall">Saved payment details - awaiting verification</Text>
                  ) : null}
                  {booking?.guestName ? (
                    <Text variant="titleMedium">{booking.guestName}</Text>
                  ) : null}
                  <Text variant="bodyMedium">{booking?.bookingCode ?? outcome.qr.bookingCode}</Text>
                  {booking ? (
                    <>
                      <Text variant="bodyMedium">
                        Room:{' '}
                        {response?.register.roomNumber ??
                          bookingDetails?.roomNumber ??
                          cached?.roomNumber ??
                          'Assigned'}
                      </Text>
                      <Text variant="bodyMedium">
                        Guests: {response?.register.totalGuests ?? booking.totalGuests}
                      </Text>
                      <Text variant="bodyMedium">
                        Check-in:{' '}
                        {response
                          ? new Date(response.register.checkInAt).toLocaleString('en-IN')
                          : booking.checkInDate}
                      </Text>
                    </>
                  ) : null}
                  <View style={styles.controls}>
                    {!operation || isPending(operation.status) ? (
                      <ActivityIndicator size="small" />
                    ) : null}
                    <Text accessibilityLiveRegion="polite">
                      {saveError ??
                        (!operation || isPending(operation.status)
                          ? isOffline
                            ? 'Waiting for connection - pending verification'
                            : operation?.status === 'RETRY_PENDING'
                              ? operation.message
                              : 'Verifying check-in...'
                          : response
                            ? 'Synchronized with server'
                            : `Check-in could not be completed. ${operation.message ?? ''}`)}
                    </Text>
                  </View>
                  {saveError ? (
                    <Button
                      onPress={() => {
                        if (sync.queue && outcome.qr) {
                          setSaveError(null);
                          void sync.queue
                            .enqueue(outcome.qr)
                            .catch((error: unknown) =>
                              setSaveError(
                                error instanceof Error ? error.message : 'Could not save scan.',
                              ),
                            );
                        }
                      }}
                    >
                      Retry saving scan
                    </Button>
                  ) : null}
                  <Button
                    mode="outlined"
                    icon="calendar-search"
                    disabled={isCollecting}
                    onPress={() => {
                      if (!outcome.qr) return;
                      router.push({
                        pathname: '/(app)/bookings/[id]',
                        params: { id: outcome.qr.bookingId },
                      });
                    }}
                  >
                    Open Booking
                  </Button>
                  {response ? (
                    <Button
                      mode="contained"
                      onPress={() =>
                        router.push({
                          pathname: '/(app)/register/[id]',
                          params: { id: response.register.id },
                        })
                      }
                    >
                      Open Guest Register
                    </Button>
                  ) : null}
                </>
              ) : (
                <Text>Ask the pilgrim to open their Tuljai Stays booking QR.</Text>
              )}
              <Button
                disabled={isCollecting || Boolean(outcome.qr && (!operation?.durable || saveError))}
                mode="contained-tonal"
                onPress={resetScanner}
              >
                Scan Next Guest
              </Button>
            </Card.Content>
          </Card>
        ) : null}
        {!outcome && sync.queue && sync.queue.list().length > 0 ? (
          <Card>
            <Card.Content style={styles.resultContent}>
              <Text variant="titleMedium">Recent scans</Text>
              {sync.queue
                .list()
                .slice(-10)
                .reverse()
                .map((item) => (
                  <Button
                    key={item.key}
                    onPress={() => {
                      setBookingDetails(null);
                      setDetailsUnavailable(false);
                      setSaveError(null);
                      setOutcome({ qr: item, status: 'QR_ALREADY_SCANNED_LOCALLY' });
                    }}
                  >
                    {item.bookingCode} -{' '}
                    {isPending(item.status)
                      ? 'Pending verification'
                      : item.status === 'CHECKED_IN' || item.status === 'ALREADY_CHECKED_IN'
                        ? 'Checked in'
                        : 'Check-in could not be completed'}
                  </Button>
                ))}
            </Card.Content>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

interface PaymentGuidance {
  detail: string | null;
  title: string;
  tone: 'collect' | 'neutral' | 'paid';
}

function getPaymentGuidance(booking: Booking): PaymentGuidance {
  const amountDue = getAmountDue(booking);

  switch (booking.paymentStatus) {
    case 'PAY_AT_LODGE':
      if (booking.payAtLodgeCollectedAt)
        return {
          detail: 'Payment collected at the lodge. Nothing to collect from the guest.',
          title: 'Payment Collected',
          tone: 'paid',
        };
      return {
        detail: amountDue
          ? `Collect ${formatAmount(amountDue)} from the guest at the lodge.`
          : 'Collect payment from the guest at the lodge.',
        title: 'Collect Payment',
        tone: 'collect',
      };
    case 'ADVANCE_PAID':
      return {
        detail: amountDue
          ? `Advance received online. Collect balance of ${formatAmount(amountDue)}.`
          : 'Advance received online. Confirm balance with the guest.',
        title: 'Advance Paid \u2014 Collect Balance',
        tone: 'collect',
      };
    case 'FULLY_PAID':
      return {
        detail: 'Full payment received online. Nothing to collect from the guest.',
        title: 'Paid Booking',
        tone: 'paid',
      };
    default:
      return {
        detail: amountDue ? `Amount: ${formatAmount(amountDue)}` : null,
        title: `Payment Status: ${formatPaymentStatusLabel(booking.paymentStatus)}`,
        tone: 'neutral',
      };
  }
}

function getAmountDue(booking: Booking): string | null {
  return (
    booking.balanceAmount ?? (booking.paymentStatus === 'ADVANCE_PAID' ? null : booking.totalAmount)
  );
}

function formatPaymentStatusLabel(status: PaymentStatus): string {
  return status
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function formatAmount(value: string): string {
  const amount = Number(value);

  return Number.isFinite(amount) ? `\u20B9${amount.toLocaleString('en-IN')}` : value;
}

function PaymentGuidanceBanner({ booking }: { booking: Booking }) {
  const guidance = getPaymentGuidance(booking);
  const amountDue = getAmountDue(booking);
  const amount = amountDue ? formatAmount(amountDue) : null;
  const amountIndex = amount && guidance.detail ? guidance.detail.indexOf(amount) : -1;
  const toneColor =
    guidance.tone === 'collect'
      ? colors.light.warning
      : guidance.tone === 'paid'
        ? colors.light.success
        : colors.light.textMuted;

  return (
    <View
      style={[styles.paymentBanner, { backgroundColor: `${toneColor}22`, borderColor: toneColor }]}
    >
      <Text style={{ color: toneColor }} variant="titleMedium">
        {guidance.title}
      </Text>
      {guidance.detail ? (
        <Text style={[styles.paymentDetail, { color: toneColor }]} variant="bodyMedium">
          {amount && amountIndex >= 0 ? (
            <>
              {guidance.detail.slice(0, amountIndex)}
              <Text style={styles.paymentAmount}>{amount}</Text>
              {guidance.detail.slice(amountIndex + amount.length)}
            </>
          ) : (
            guidance.detail
          )}
        </Text>
      ) : null}
    </View>
  );
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
  paymentBanner: {
    borderRadius: radius.sm,
    borderWidth: 1.5,
    gap: spacing.xs,
    padding: spacing.md,
  },
  paymentAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  paymentDetail: {
    lineHeight: 28,
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
