import { StyleSheet } from 'react-native';

import { useColors } from '../design/theme';
import { radius, space } from '../design/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export function FilterChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const colors = useColors();

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      pressedScale={0.95}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.line,
        },
      ]}
      onPress={onPress}
    >
      <Text color={selected ? 'onPrimary' : 'ink'} variant="label">
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
});
