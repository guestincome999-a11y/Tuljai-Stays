import type { GuestRegister } from '@tuljai/types';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { type RegisterQuickFilter, useRegisterDashboard } from '../hooks/useRegisterDashboard';

const filters: Array<{ label: string; value: RegisterQuickFilter }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Today', value: 'TODAY' },
  { label: 'Checked In', value: 'CHECKED_IN' },
  { label: 'Checked Out', value: 'CHECKED_OUT' },
  { label: 'Upcoming Checkout', value: 'UPCOMING_CHECKOUT' },
  { label: 'This Week', value: 'THIS_WEEK' },
];

export function RegisterDashboardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [filter, setFilter] = useState<RegisterQuickFilter>('TODAY');
  const [searchText, setSearchText] = useState('');
  const registerDashboard = useRegisterDashboard(searchText, filter);

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void registerDashboard.refresh();
          }}
          refreshing={registerDashboard.isRefreshing}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text variant="headlineSmall">Register Dashboard</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
          {registerDashboard.selectedLodge?.name ?? 'No lodge selected'}
        </Text>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard label="Today's Arrivals" value={registerDashboard.summary.todayArrivals} />
        <SummaryCard label="Today's Departures" value={registerDashboard.summary.todayDepartures} />
        <SummaryCard
          label="Guests Staying"
          value={registerDashboard.summary.guestsCurrentlyStaying}
        />
        <SummaryCard label="Checked In" value={registerDashboard.summary.checkedInCount} />
        <SummaryCard label="Checked Out" value={registerDashboard.summary.checkedOutCount} />
        <SummaryCard label="Pending Check-ins" value={registerDashboard.summary.pendingCheckIns} />
        <SummaryCard
          label="Rooms Cleaning"
          value={registerDashboard.summary.roomsRequiringCleaning}
        />
        <SummaryCard label="Maintenance" value={registerDashboard.summary.roomsUnderMaintenance} />
      </View>

      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Checkout Reminders</Text>
          <Text variant="bodyMedium">
            {registerDashboard.summary.upcomingCheckoutReminders} active guests have checkout times
            that need reception monitoring.
          </Text>
          <Button
            accessibilityHint="Filters the register list to active guests with upcoming checkout."
            accessibilityLabel="View upcoming checkout reminders"
            mode="contained-tonal"
            onPress={() => setFilter('UPCOMING_CHECKOUT')}
          >
            View Upcoming Checkouts
          </Button>
        </Card.Content>
      </Card>

      <TextInput
        accessibilityLabel="Search guest register"
        label="Search booking, guest, phone, room, date, status"
        mode="outlined"
        value={searchText}
        onChangeText={setSearchText}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filters}>
          {filters.map((item) => (
            <Button
              key={item.value}
              mode={filter === item.value ? 'contained' : 'outlined'}
              onPress={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </View>
      </ScrollView>

      <FormErrorBanner
        message={
          registerDashboard.errorMessage ??
          (registerDashboard.isOffline ? 'Register actions are disabled while offline.' : null)
        }
      />

      {registerDashboard.isLoading ? <ActivityIndicator animating size="large" /> : null}

      {!registerDashboard.isLoading && registerDashboard.filteredRegisters.length === 0 ? (
        <EmptyState
          title="No register entries"
          description="Matching guest register entries will appear here."
          actionLabel="Refresh"
          onActionPress={() => {
            void registerDashboard.refresh();
          }}
        />
      ) : null}

      <View style={styles.list}>
        {registerDashboard.filteredRegisters.map((register) => (
          <RegisterCard
            key={register.id}
            register={register}
            onOpen={() =>
              router.push({ pathname: '/(app)/register/[id]', params: { id: register.id } })
            }
          />
        ))}
      </View>
    </ScrollView>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  const theme = useTheme();

  return (
    <Card mode="outlined" style={styles.summaryCard}>
      <Card.Content style={styles.summaryContent}>
        <Text style={{ color: theme.colors.primary }} variant="headlineSmall">
          {value}
        </Text>
        <Text variant="bodySmall">{label}</Text>
      </Card.Content>
    </Card>
  );
}

const RegisterCard = memo(function RegisterCard({
  onOpen,
  register,
}: {
  onOpen: () => void;
  register: GuestRegister;
}) {
  const theme = useTheme();
  const checkoutState = getCheckoutState(register);

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.titleBlock}>
            <Text variant="titleMedium">{register.primaryGuestName}</Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
              {register.bookingCode} - {register.registerCode}
            </Text>
          </View>
          <Chip>{formatStatus(register.status)}</Chip>
        </View>
        <Text variant="bodyMedium">Room: {register.roomNumber ?? 'Assigned'}</Text>
        <Text variant="bodyMedium">Guests: {register.totalGuests}</Text>
        <Text variant="bodyMedium">
          Expected checkout:{' '}
          {register.expectedCheckoutAt
            ? new Date(register.expectedCheckoutAt).toLocaleString('en-IN')
            : 'Not set'}
        </Text>
        {checkoutState ? <Chip icon="clock-alert-outline">{checkoutState}</Chip> : null}
        <View style={styles.actions}>
          <Button
            accessibilityHint="Opens the full guest register detail."
            accessibilityLabel={`View register for ${register.primaryGuestName}`}
            mode="contained-tonal"
            onPress={onOpen}
          >
            View Register
          </Button>
          <Button
            accessibilityHint="Opens the register note editor."
            accessibilityLabel={`Add note for ${register.primaryGuestName}`}
            mode="outlined"
            onPress={onOpen}
          >
            Add Note
          </Button>
          <Button
            accessibilityHint="Opens the ID verification controls."
            accessibilityLabel={`Mark ID verified for ${register.primaryGuestName}`}
            mode="outlined"
            onPress={onOpen}
          >
            Mark ID Verified
          </Button>
          {register.status === 'CHECKED_IN' ? (
            <Button
              accessibilityHint="Opens checkout controls for this register."
              accessibilityLabel={`Mark checkout for ${register.primaryGuestName}`}
              mode="outlined"
              onPress={onOpen}
            >
              Mark Checkout
            </Button>
          ) : null}
        </View>
      </Card.Content>
    </Card>
  );
});

function getCheckoutState(register: GuestRegister): string | null {
  if (!register.expectedCheckoutAt || register.status !== 'CHECKED_IN') {
    return null;
  }

  const checkoutAt = new Date(register.expectedCheckoutAt);
  const now = new Date();

  if (checkoutAt < now) {
    return 'Overdue for checkout';
  }

  if (checkoutAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) {
    return 'Due today';
  }

  return 'Upcoming checkout';
}

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
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
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  header: {
    gap: spacing.xs,
  },
  list: {
    gap: spacing.md,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  summaryCard: {
    borderRadius: radius.sm,
    flexBasis: '47%',
    flexGrow: 1,
  },
  summaryContent: {
    gap: spacing.xs,
    minHeight: 88,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
