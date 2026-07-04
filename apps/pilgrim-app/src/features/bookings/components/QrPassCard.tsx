import type { Booking, QrDisplayPayload } from '@tuljai/types';
import { radius, spacing } from '@tuljai/ui';
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

        {metadata?.status === 'ACTIVE' ? (
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
              Valid until {new Date(metadata.expiresAt).toLocaleString()}
            </Text>
          ) : null}
        </View>

        <Button disabled={isOffline || isLoading} mode="contained-tonal" onPress={onRefresh}>
          Refresh Status
        </Button>
      </Card.Content>
    </Card>
  );
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
