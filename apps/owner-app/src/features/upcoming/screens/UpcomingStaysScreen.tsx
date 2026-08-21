import type { GuestRegister, OwnerBookingSummary } from '@tuljai/types';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, useTheme } from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useUpcomingStays } from '../hooks/useUpcomingStays';

type UpcomingSection = 'CHECK_INS' | 'CHECK_OUTS';

export function UpcomingStaysScreen() {
  const router = useRouter();
  const theme = useTheme();
  const upcoming = useUpcomingStays();
  const [section, setSection] = useState<UpcomingSection>('CHECK_INS');

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void upcoming.refresh();
          }}
          refreshing={upcoming.isRefreshing}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text variant="headlineSmall">Upcoming Stays</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
          {upcoming.selectedLodge?.name ?? 'No lodge selected'}
        </Text>
      </View>

      <View style={styles.headerSections}>
        <HeaderSection
          active={section === 'CHECK_INS'}
          icon="login"
          label="Check-ins"
          value={upcoming.checkIns.length}
          onPress={() => setSection('CHECK_INS')}
        />
        <HeaderSection
          active={section === 'CHECK_OUTS'}
          icon="logout"
          label="Check-outs"
          value={upcoming.checkOuts.length}
          onPress={() => setSection('CHECK_OUTS')}
        />
      </View>

      <FormErrorBanner message={upcoming.errorMessage} />
      {upcoming.isLoading ? <ActivityIndicator animating size="large" /> : null}

      {!upcoming.isLoading && section === 'CHECK_INS' ? (
        <View style={styles.list}>
          <Text variant="titleLarge">Upcoming Check-ins</Text>
          {upcoming.checkIns.length === 0 ? (
            <EmptyState
              title="No upcoming check-ins"
              description="Accepted bookings and QR-ready arrivals will appear here."
            />
          ) : null}
          {upcoming.checkIns.map((booking) => (
            <CheckInCard
              booking={booking}
              key={booking.id}
              onOpen={() =>
                router.push({ pathname: '/(app)/bookings/[id]', params: { id: booking.id } })
              }
            />
          ))}
        </View>
      ) : null}

      {!upcoming.isLoading && section === 'CHECK_OUTS' ? (
        <View style={styles.list}>
          <Text variant="titleLarge">Upcoming Check-outs</Text>
          {upcoming.checkOuts.length === 0 ? (
            <EmptyState
              title="No upcoming check-outs"
              description="Guests currently staying will appear here until checkout."
            />
          ) : null}
          {upcoming.checkOuts.map((register) => (
            <CheckOutCard
              key={register.id}
              register={register}
              onOpen={() =>
                router.push({ pathname: '/(app)/register/[id]', params: { id: register.id } })
              }
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function HeaderSection({
  active,
  icon,
  label,
  onPress,
  value,
}: {
  active: boolean;
  icon: 'login' | 'logout';
  label: string;
  onPress: () => void;
  value: number;
}) {
  return (
    <Button
      contentStyle={styles.headerSectionContent}
      icon={icon}
      mode={active ? 'contained' : 'outlined'}
      style={styles.headerSection}
      onPress={onPress}
    >
      {label} · {value}
    </Button>
  );
}

function CheckInCard({ booking, onOpen }: { booking: OwnerBookingSummary; onOpen: () => void }) {
  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.titleBlock}>
            <Text variant="titleMedium">{booking.guestName}</Text>
            <Text variant="bodySmall">{booking.bookingCode}</Text>
          </View>
          <Chip>{booking.status === 'QR_GENERATED' ? 'QR Ready' : 'Accepted'}</Chip>
        </View>
        <Text variant="bodyMedium">Check-in: {formatDate(booking.checkInDate)}</Text>
        <Text variant="bodyMedium">
          Room: {booking.roomNumber ?? booking.roomTypeName} · Guests: {booking.totalGuests}
        </Text>
        <Button mode="contained-tonal" onPress={onOpen}>
          View Booking
        </Button>
      </Card.Content>
    </Card>
  );
}

function CheckOutCard({ onOpen, register }: { onOpen: () => void; register: GuestRegister }) {
  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.titleBlock}>
            <Text variant="titleMedium">{register.primaryGuestName}</Text>
            <Text variant="bodySmall">{register.bookingCode}</Text>
          </View>
          <Chip>Staying</Chip>
        </View>
        <Text variant="bodyMedium">
          Expected checkout:{' '}
          {register.expectedCheckoutAt
            ? new Date(register.expectedCheckoutAt).toLocaleString('en-IN')
            : 'Not set'}
        </Text>
        <Text variant="bodyMedium">
          Room: {register.roomNumber ?? 'Assigned'} · Guests: {register.totalGuests}
        </Text>
        <Button mode="contained-tonal" onPress={onOpen}>
          Open Guest Register
        </Button>
      </Card.Content>
    </Card>
  );
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
  },
  cardContent: {
    gap: spacing.sm,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  header: {
    gap: spacing.xs,
  },
  headerSection: {
    flex: 1,
  },
  headerSectionContent: {
    minHeight: 58,
  },
  headerSections: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  list: {
    gap: spacing.md,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
