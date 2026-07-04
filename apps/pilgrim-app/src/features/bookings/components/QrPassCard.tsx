import type { Booking, QrDisplayPayload } from '@tuljai/types';
import { radius, spacing } from '@tuljai/ui';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Text, useTheme } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';

interface QrPassCardProps {
  booking: Booking;
  errorMessage: string | null;
  isLoading: boolean;
  isOffline: boolean;
  lodgeName: string;
  metadata: QrDisplayPayload | null;
  onRefresh: () => void;
  roomTypeName: string;
}

export function QrPassCard({
  booking,
  errorMessage,
  isLoading,
  isOffline,
  lodgeName,
  metadata,
  onRefresh,
  roomTypeName,
}: QrPassCardProps) {
  const theme = useTheme();
  const qrAllowed = booking.status === 'ACCEPTED' || booking.status === 'QR_GENERATED';
  const [now, setNow] = useState(Date.now());
  const millisecondsUntilExpiry = metadata ? new Date(metadata.expiresAt).getTime() - now : null;
  const expired = millisecondsUntilExpiry !== null && millisecondsUntilExpiry <= 0;
  const expiryLabel = useMemo(
    () => formatExpiryCountdown(millisecondsUntilExpiry),
    [millisecondsUntilExpiry],
  );

  useEffect(() => {
    if (!metadata) {
      return undefined;
    }

    const interval = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(interval);
  }, [metadata]);

  useEffect(() => {
    if (
      !metadata ||
      isOffline ||
      isLoading ||
      millisecondsUntilExpiry === null ||
      millisecondsUntilExpiry <= 0 ||
      millisecondsUntilExpiry > 300_000
    ) {
      return;
    }

    const timeout = setTimeout(onRefresh, 1500);

    return () => clearTimeout(timeout);
  }, [isLoading, isOffline, metadata, millisecondsUntilExpiry, onRefresh]);

  if (!qrAllowed) {
    return (
      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.content}>
          <Text variant="titleMedium">QR Pass</Text>
          <Text variant="bodyMedium">{getUnavailableQrMessage(booking.status)}</Text>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card mode="contained" style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <Text variant="titleMedium">QR Pass</Text>
          {isLoading ? <ActivityIndicator animating /> : null}
        </View>

        {metadata?.status === 'ACTIVE' && !expired ? (
          <View style={styles.qrShell}>
            <View style={[styles.qrPlaceholder, { backgroundColor: theme.colors.surface }]}>
              <QRCode
                backgroundColor={theme.colors.surface}
                color={theme.colors.onSurface}
                size={220}
                value={metadata.qrPayload}
              />
            </View>
            <Text style={styles.centerText} variant="titleMedium">
              QR pass is ready
            </Text>
            <Text style={styles.centerText} variant="bodyMedium">
              Show this QR at the lodge reception for faster check-in.
            </Text>
          </View>
        ) : expired ? (
          <Text variant="bodyMedium">QR expired. Reconnect and refresh your QR pass.</Text>
        ) : (
          <Text variant="bodyMedium">
            {errorMessage ?? 'QR will appear after lodge approval and QR generation.'}
          </Text>
        )}

        <View style={styles.detailRows}>
          <Text variant="bodySmall">{booking.bookingCode}</Text>
          <Text variant="bodySmall">{lodgeName}</Text>
          <Text variant="bodySmall">{roomTypeName}</Text>
          <Text variant="bodySmall">
            {booking.checkInDate} to {booking.checkOutDate}
          </Text>
          <Text variant="bodySmall">{booking.guestName}</Text>
          {metadata ? (
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
              {expiryLabel}
            </Text>
          ) : null}
        </View>

        <Button disabled={isOffline || isLoading} mode="contained-tonal" onPress={onRefresh}>
          Refresh QR
        </Button>
      </Card.Content>
    </Card>
  );
}

function formatExpiryCountdown(millisecondsUntilExpiry: number | null): string {
  if (millisecondsUntilExpiry === null) {
    return '';
  }

  if (millisecondsUntilExpiry <= 0) {
    return 'Expired';
  }

  const totalSeconds = Math.ceil(millisecondsUntilExpiry / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `Expires in ${hours}h ${remainingMinutes}m`;
  }

  return `Expires in ${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function getUnavailableQrMessage(status: Booking['status']): string {
  if (status === 'PENDING_OWNER_APPROVAL') {
    return 'Your booking request is waiting for lodge approval.';
  }

  if (status === 'REJECTED') {
    return 'This booking was not accepted by the lodge. You may browse other available stays.';
  }

  if (status === 'CANCELLED' || status === 'EXPIRED' || status === 'NO_SHOW') {
    return 'QR pass is not available for this booking status.';
  }

  if (status === 'CHECKED_IN') {
    return 'Check-in completed.';
  }

  if (status === 'CHECKED_OUT' || status === 'COMPLETED') {
    return 'This stay is complete.';
  }

  return 'QR will appear after lodge approval.';
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
  },
  centerText: {
    textAlign: 'center',
  },
  content: {
    gap: spacing.md,
  },
  detailRows: {
    gap: spacing.xs,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  qrPlaceholder: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: radius.sm,
    justifyContent: 'center',
    width: 260,
  },
  qrShell: {
    alignItems: 'center',
    gap: spacing.md,
  },
});
