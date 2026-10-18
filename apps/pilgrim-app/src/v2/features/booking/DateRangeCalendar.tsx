import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { addDays, parseDateOnly, startOfToday, toDateOnly } from '../../core/dates';
import { useColors } from '../../design/theme';
import { gutter, radius, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';

const MONTHS_SHOWN = 4;
const WEEKDAYS = {
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  mr: ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'],
} as const;

interface MonthCells {
  key: string;
  title: Date;
  cells: Array<string | null>;
}

function buildMonths(today: Date): MonthCells[] {
  return Array.from({ length: MONTHS_SHOWN }, (_, offset) => {
    const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells: Array<string | null> = Array.from({ length: first.getDay() }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(toDateOnly(new Date(first.getFullYear(), first.getMonth(), day)));
    }
    return { cells, key: toDateOnly(first), title: first };
  });
}

/** Tap a first day to start a stay, then a later day to end it. Tapping again starts over. */
export function DateRangeCalendar({
  checkIn,
  checkOut,
  onSelect,
}: {
  checkIn: string | null;
  checkOut: string | null;
  onSelect: (checkIn: string, checkOut: string | null) => void;
}) {
  const colors = useColors();
  const { lang } = useLang();
  const { width } = useWindowDimensions();
  const cellSize = Math.floor((width - gutter * 2) / 7);
  const today = startOfToday();
  const todayKey = toDateOnly(today);
  const months = buildMonths(today);
  const lastBookable = toDateOnly(addDays(today, 365));

  function onDayPress(day: string) {
    if (checkIn && !checkOut && day > checkIn) onSelect(checkIn, day);
    else onSelect(day, null);
  }

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAYS[lang].map((label, index) => (
          <View key={index} style={{ width: cellSize }}>
            <Text align="center" color="inkMuted" variant="caption">
              {label}
            </Text>
          </View>
        ))}
      </View>
      {months.map((month) => (
        <View key={month.key} style={styles.month}>
          <Text style={styles.monthTitle} variant="heading">
            {month.title.toLocaleDateString(lang === 'mr' ? 'mr-IN' : 'en-IN', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          <View style={styles.grid}>
            {month.cells.map((day, index) => {
              if (day === null) return <View key={`blank-${index}`} style={{ width: cellSize }} />;
              const past = day < todayKey || day > lastBookable;
              const isStart = day === checkIn;
              const isEnd = day === checkOut;
              const inRange =
                checkIn !== null && checkOut !== null && day > checkIn && day < checkOut;
              const filled = isStart || isEnd;
              return (
                <View
                  key={day}
                  style={[
                    { height: cellSize, width: cellSize },
                    styles.cellWrap,
                    inRange ? { backgroundColor: colors.primarySoft } : null,
                    isStart && checkOut
                      ? {
                          backgroundColor: colors.primarySoft,
                          borderTopLeftRadius: radius.pill,
                          borderBottomLeftRadius: radius.pill,
                        }
                      : null,
                    isEnd
                      ? {
                          backgroundColor: colors.primarySoft,
                          borderTopRightRadius: radius.pill,
                          borderBottomRightRadius: radius.pill,
                        }
                      : null,
                  ]}
                >
                  <PressableScale
                    accessibilityLabel={day}
                    accessibilityState={{ disabled: past, selected: filled }}
                    disabled={past}
                    pressedScale={0.9}
                    style={[
                      styles.day,
                      { height: cellSize - 6, width: cellSize - 6 },
                      filled ? { backgroundColor: colors.primary } : null,
                    ]}
                    onPress={() => onDayPress(day)}
                  >
                    <Text color={filled ? 'onPrimary' : past ? 'inkFaint' : 'ink'} variant="label">
                      {parseDateOnly(day).getDate()}
                    </Text>
                  </PressableScale>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cellWrap: { alignItems: 'center', justifyContent: 'center' },
  day: { alignItems: 'center', borderRadius: radius.pill, justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  month: { marginTop: space.xl },
  monthTitle: { marginBottom: space.sm },
  weekRow: { flexDirection: 'row' },
});
