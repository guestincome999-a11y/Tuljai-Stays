import { radius, spacing } from '@tuljai/ui';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Snackbar,
  Switch,
  Text,
  useTheme,
} from 'react-native-paper';

import { useOwnerSettings } from '../hooks/useOwnerSettings';
import {
  type OwnerDashboardTab,
  type OwnerLanguage,
  type OwnerThemeMode,
} from '../storage/owner-settings-store';

const themeModes: Array<{ label: string; value: OwnerThemeMode }> = [
  { label: 'System', value: 'SYSTEM' },
  { label: 'Light', value: 'LIGHT' },
  { label: 'Dark', value: 'DARK' },
];

const languages: Array<{ label: string; value: OwnerLanguage }> = [
  { label: 'English', value: 'EN' },
  { label: 'Marathi', value: 'MR' },
  { label: 'Hindi', value: 'HI' },
];

const dashboardTabs: Array<{ label: string; value: OwnerDashboardTab }> = [
  { label: 'Dashboard', value: 'DASHBOARD' },
  { label: 'Bookings', value: 'BOOKINGS' },
  { label: 'Register', value: 'REGISTER' },
  { label: 'Rooms', value: 'ROOMS' },
];

export function OwnerSettingsScreen() {
  const theme = useTheme();
  const settings = useOwnerSettings();

  if (settings.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.header}>
          <Text variant="headlineSmall">Operational Settings</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
            Device preferences for reception work. Backend system settings remain admin controlled.
          </Text>
        </View>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Reception Preferences</Text>
            <ToggleRow
              label="Reception Mode Default"
              value={settings.settings.receptionModeDefault}
              onValueChange={(value) => {
                void settings.update({ receptionModeDefault: value });
              }}
            />
            <ToggleRow
              label="Auto-open Scanner After Check-in"
              value={settings.settings.autoOpenScannerAfterCheckIn}
              onValueChange={(value) => {
                void settings.update({ autoOpenScannerAfterCheckIn: value });
              }}
            />
            <ToggleRow
              label="Large Text Mode"
              value={settings.settings.largeTextMode}
              onValueChange={(value) => {
                void settings.update({ largeTextMode: value });
              }}
            />
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Notifications</Text>
            <ToggleRow
              label="Notification Sound"
              value={settings.settings.notificationSound}
              onValueChange={(value) => {
                void settings.update({ notificationSound: value });
              }}
            />
            <ToggleRow
              label="Vibration"
              value={settings.settings.vibration}
              onValueChange={(value) => {
                void settings.update({ vibration: value });
              }}
            />
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Appearance</Text>
            <OptionChips
              currentValue={settings.settings.themeMode}
              options={themeModes}
              onChange={(themeMode) => {
                void settings.update({ themeMode });
              }}
            />
            <Text variant="titleMedium">Language Foundation</Text>
            <OptionChips
              currentValue={settings.settings.language}
              options={languages}
              onChange={(language) => {
                void settings.update({ language });
              }}
            />
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
              Translation files will be wired in a later localization phase.
            </Text>
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Default Dashboard Tab</Text>
            <OptionChips
              currentValue={settings.settings.dashboardTab}
              options={dashboardTabs}
              onChange={(dashboardTab) => {
                void settings.update({ dashboardTab });
              }}
            />
            <Button
              mode="contained-tonal"
              onPress={() => {
                void settings.update({
                  autoOpenScannerAfterCheckIn: false,
                  dashboardTab: 'DASHBOARD',
                  language: 'EN',
                  largeTextMode: false,
                  notificationSound: true,
                  receptionModeDefault: false,
                  themeMode: 'SYSTEM',
                  vibration: true,
                });
              }}
            >
              Reset Device Preferences
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      <Snackbar
        onDismiss={() => settings.setSuccessMessage(null)}
        visible={Boolean(settings.successMessage)}
      >
        {settings.successMessage}
      </Snackbar>
    </View>
  );
}

function ToggleRow({
  label,
  onValueChange,
  value,
}: {
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text variant="bodyLarge">{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onValueChange} />
    </View>
  );
}

function OptionChips<TValue extends string>({
  currentValue,
  onChange,
  options,
}: {
  currentValue: TValue;
  onChange: (value: TValue) => void;
  options: Array<{ label: string; value: TValue }>;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => (
        <Chip
          key={option.value}
          selected={currentValue === option.value}
          onPress={() => onChange(option.value)}
        >
          {option.label}
        </Chip>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
  },
  cardContent: {
    gap: spacing.md,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  container: {
    flex: 1,
  },
  header: {
    gap: spacing.xs,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 48,
  },
});
