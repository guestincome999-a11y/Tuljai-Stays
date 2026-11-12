import { validReportRange } from '@tuljai/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  Icon,
  IconButton,
  Portal,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

export function ReportDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(() => new Date(`${value.slice(0, 7)}-01T00:00:00Z`));
  const year = month.getUTCFullYear();
  const number = month.getUTCMonth();
  const offset = new Date(Date.UTC(year, number, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, number + 1, 0)).getUTCDate();
  const valid = validReportRange({ startDate: draft, endDate: draft });
  const formatted = new Date(`${value}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return (
    <View style={styles.field}>
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatted}. Change date`}
        onPress={() => {
          setDraft(value);
          setMonth(new Date(`${value.slice(0, 7)}-01T00:00:00Z`));
          setOpen(true);
        }}
        style={[
          styles.trigger,
          { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface },
        ]}
      >
        <Icon source="calendar-month-outline" size={20} color={theme.colors.primary} />
        <Text variant="bodyMedium">{formatted}</Text>
      </Pressable>
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)} style={styles.dialog}>
          <Dialog.Title>{label}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Date (YYYY-MM-DD)"
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                if (validReportRange({ startDate: text, endDate: text }))
                  setMonth(new Date(`${text.slice(0, 7)}-01T00:00:00Z`));
              }}
              error={!valid}
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.monthHeader}>
              <IconButton
                icon="chevron-left"
                accessibilityLabel="Previous month"
                onPress={() => setMonth(new Date(Date.UTC(year, number - 1, 1)))}
              />
              <Text variant="titleSmall">
                {month.toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </Text>
              <IconButton
                icon="chevron-right"
                accessibilityLabel="Next month"
                onPress={() => setMonth(new Date(Date.UTC(year, number + 1, 1)))}
              />
            </View>
            <View style={styles.grid}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <View key={day} style={styles.day}>
                  <Text variant="labelSmall">{day}</Text>
                </View>
              ))}
              {Array.from({ length: offset + count }, (_, index) => {
                const day = index - offset + 1;
                const iso = new Date(Date.UTC(year, number, Math.max(day, 1)))
                  .toISOString()
                  .slice(0, 10);
                return day < 1 ? (
                  <View key={index} style={styles.day} />
                ) : (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={iso}
                    accessibilityState={{ selected: iso === draft }}
                    onPress={() => setDraft(iso)}
                    style={[
                      styles.day,
                      {
                        borderRadius: 20,
                        backgroundColor: iso === draft ? theme.colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: iso === draft ? theme.colors.onPrimary : theme.colors.onSurface,
                      }}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!valid}
              mode="contained"
              onPress={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Use date
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
const styles = StyleSheet.create({
  field: { flex: 1, minWidth: 135, gap: 8 },
  trigger: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dialog: { maxWidth: 440, width: '92%', alignSelf: 'center' },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: '14.2857%', height: 40, alignItems: 'center', justifyContent: 'center' },
});
