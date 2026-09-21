import { radius, spacing } from '@tuljai/ui';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, IconButton, Text, useTheme } from 'react-native-paper';

import { formatDateKey, parseDateKey, toDateKey } from '../utils/booking-display';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface DateRangeModalProps {
  applyLabel?: string;
  hint?: string;
  initialFrom: string | null;
  initialTo: string | null;
  isSubmitting?: boolean;
  onApply: (from: string, to: string) => void;
  onCancel: () => void;
  // First day that can be picked (YYYY-MM-DD). Earlier days are disabled.
  minDate?: string;
  // When true the end date must be after the start date (a stay, not a single day).
  requireRange?: boolean;
  title?: string;
  visible: boolean;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function DateRangeModal({
  applyLabel = 'Apply',
  hint = 'Tap a start date, then an end date. Tap one date twice for a single day.',
  initialFrom,
  initialTo,
  isSubmitting = false,
  minDate,
  onApply,
  onCancel,
  requireRange = false,
  title = 'Choose check-in dates',
  visible,
}: DateRangeModalProps) {
  const theme = useTheme();
  const [from, setFrom] = useState<string | null>(initialFrom);
  const [to, setTo] = useState<string | null>(initialTo);
  const [cursor, setCursor] = useState<Date>(() =>
    startOfMonth(initialFrom ? parseDateKey(initialFrom) : new Date()),
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    setFrom(initialFrom);
    setTo(initialTo);
    setCursor(startOfMonth(initialFrom ? parseDateKey(initialFrom) : new Date()));
  }, [initialFrom, initialTo, visible]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const leadingBlanks = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: Array<string | null> = Array.from({ length: leadingBlanks }, () => null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      result.push(toDateKey(new Date(year, month, day)));
    }

    return result;
  }, [cursor]);

  const rangeEnd = to ?? from;
  const canApply = Boolean(from) && (!requireRange || Boolean(to && from && to > from));

  function selectDay(key: string) {
    if (minDate && key < minDate) {
      return;
    }

    if (!from || to) {
      setFrom(key);
      setTo(null);
      return;
    }

    if (key < from) {
      setFrom(key);
      return;
    }

    if (requireRange && key === from) {
      return;
    }

    setTo(key);
  }

  function shiftMonth(delta: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <Modal animationType="slide" onRequestClose={onCancel} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.content}>
            <Text variant="titleLarge">{title}</Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
              {hint}
            </Text>

            <View style={styles.monthRow}>
              <IconButton
                accessibilityLabel="Previous month"
                icon="chevron-left"
                onPress={() => shiftMonth(-1)}
              />
              <Text variant="titleMedium">
                {cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </Text>
              <IconButton
                accessibilityLabel="Next month"
                icon="chevron-right"
                onPress={() => shiftMonth(1)}
              />
            </View>

            <View style={styles.grid}>
              {WEEKDAYS.map((weekday, index) => (
                <View key={`weekday-${index}`} style={styles.cell}>
                  <Text style={{ color: theme.colors.onSurfaceVariant }} variant="labelSmall">
                    {weekday}
                  </Text>
                </View>
              ))}
              {cells.map((key, index) => {
                if (!key) {
                  return <View key={`blank-${index}`} style={styles.cell} />;
                }

                const isDisabled = Boolean(minDate && key < minDate);
                const isEndpoint = key === from || key === rangeEnd;
                const isInRange = Boolean(from && rangeEnd && key >= from && key <= rangeEnd);

                return (
                  <View key={key} style={styles.cell}>
                    <Pressable
                      accessibilityLabel={formatDateKey(key)}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isDisabled, selected: isInRange }}
                      disabled={isDisabled}
                      onPress={() => selectDay(key)}
                      style={[
                        styles.day,
                        isInRange ? { backgroundColor: theme.colors.primaryContainer } : null,
                        isEndpoint ? { backgroundColor: theme.colors.primary } : null,
                        isDisabled ? styles.dayDisabled : null,
                      ]}
                    >
                      <Text
                        style={{
                          color: isEndpoint
                            ? theme.colors.onPrimary
                            : isInRange
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onSurface,
                        }}
                        variant="bodyMedium"
                      >
                        {Number(key.slice(8, 10))}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <Text variant="bodyMedium">
              {from && rangeEnd
                ? from === rangeEnd
                  ? formatDateKey(from)
                  : `${formatDateKey(from)} – ${formatDateKey(rangeEnd)}`
                : 'No dates selected'}
            </Text>

            <View style={styles.actions}>
              <Button disabled={isSubmitting} mode="outlined" onPress={onCancel}>
                Cancel
              </Button>
              <Button
                disabled={!canApply || isSubmitting}
                loading={isSubmitting}
                mode="contained"
                onPress={() => {
                  if (from) {
                    onApply(from, to ?? from);
                  }
                }}
              >
                {applyLabel}
              </Button>
            </View>
          </Card.Content>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.sm,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    width: `${100 / 7}%`,
  },
  content: {
    gap: spacing.md,
  },
  day: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  dayDisabled: {
    opacity: 0.35,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
