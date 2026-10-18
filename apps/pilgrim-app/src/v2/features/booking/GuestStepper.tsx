import { StyleSheet, View } from 'react-native';

import { useColors } from '../../design/theme';
import { radius, space } from '../../design/tokens';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';

export function GuestStepper({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  const colors = useColors();
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View style={styles.row}>
      <Text variant="body">{label}</Text>
      <View style={styles.controls}>
        <PressableScale
          accessibilityLabel={`${label} -`}
          disabled={atMin}
          hitSlop={space.sm}
          style={[styles.button, { borderColor: colors.line, opacity: atMin ? 0.4 : 1 }]}
          onPress={() => onChange(value - 1)}
        >
          <Icon color="primary" name="minus" size={18} />
        </PressableScale>
        <Text align="center" style={styles.value} variant="heading">
          {value}
        </Text>
        <PressableScale
          accessibilityLabel={`${label} +`}
          disabled={atMax}
          hitSlop={space.sm}
          style={[styles.button, { borderColor: colors.line, opacity: atMax ? 0.4 : 1 }]}
          onPress={() => onChange(value + 1)}
        >
          <Icon color="primary" name="plus" size={18} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  controls: { alignItems: 'center', flexDirection: 'row', gap: space.md },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  value: { minWidth: 28 },
});
