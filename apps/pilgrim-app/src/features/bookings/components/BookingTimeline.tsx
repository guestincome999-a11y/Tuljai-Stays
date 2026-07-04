import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Booking, BookingStatus } from '@tuljai/types';
import { radius, spacing } from '@tuljai/ui';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface BookingTimelineProps {
  booking: Booking;
}

const lifecycleSteps: Array<{ label: string; status: BookingStatus }> = [
  { label: 'Booking Requested', status: 'PENDING_OWNER_APPROVAL' },
  { label: 'Owner Accepted', status: 'ACCEPTED' },
  { label: 'QR Ready', status: 'QR_GENERATED' },
  { label: 'Checked In', status: 'CHECKED_IN' },
  { label: 'Checked Out', status: 'CHECKED_OUT' },
  { label: 'Completed', status: 'COMPLETED' },
];

const terminalLabels: Partial<Record<BookingStatus, string>> = {
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  NO_SHOW: 'No Show',
  REJECTED: 'Rejected',
};

export function BookingTimeline({ booking }: BookingTimelineProps) {
  const theme = useTheme();
  const currentIndex = getCurrentLifecycleIndex(booking.status);
  const steps = terminalLabels[booking.status]
    ? [
        { label: 'Booking Requested', status: 'PENDING_OWNER_APPROVAL' as const },
        { label: terminalLabels[booking.status], status: booking.status },
      ]
    : lifecycleSteps;

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const state = getStepState(index, currentIndex, booking.status);
        const color =
          state === 'completed' || state === 'active' ? theme.colors.primary : theme.colors.outline;

        return (
          <View key={`${step.status}-${step.label}`} style={styles.step}>
            <View style={[styles.icon, { borderColor: color }]}>
              <MaterialCommunityIcons
                color={color}
                name={
                  state === 'completed'
                    ? 'check'
                    : state === 'active'
                      ? 'circle-slice-8'
                      : 'circle-outline'
                }
                size={18}
              />
            </View>
            <View style={styles.stepText}>
              <Text variant="titleSmall">{step.label}</Text>
              <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
                {getStepTimestamp(step.status, booking) ??
                  (state === 'pending' ? 'Pending' : 'Updated')}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function getCurrentLifecycleIndex(status: BookingStatus): number {
  const index = lifecycleSteps.findIndex((step) => step.status === status);

  if (status === 'ACCEPTED') {
    return 1;
  }

  if (status === 'CHECKED_OUT') {
    return 4;
  }

  return index >= 0 ? index : 0;
}

function getStepState(
  index: number,
  currentIndex: number,
  bookingStatus: BookingStatus,
): 'active' | 'completed' | 'pending' {
  if (terminalLabels[bookingStatus]) {
    return index === 1 ? 'active' : 'completed';
  }

  if (index < currentIndex) {
    return 'completed';
  }

  if (index === currentIndex) {
    return 'active';
  }

  return 'pending';
}

function getStepTimestamp(status: BookingStatus, booking: Booking): string | null {
  if (status === 'PENDING_OWNER_APPROVAL') {
    return new Date(booking.createdAt).toLocaleString();
  }

  if (status === 'CHECKED_IN' && booking.checkedInAt) {
    return new Date(booking.checkedInAt).toLocaleString();
  }

  if ((status === 'CHECKED_OUT' || status === 'COMPLETED') && booking.checkedOutAt) {
    return new Date(booking.checkedOutAt).toLocaleString();
  }

  if (status === booking.status) {
    return new Date(booking.updatedAt).toLocaleString();
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  icon: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  step: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepText: {
    flex: 1,
    gap: spacing.xs,
  },
});
