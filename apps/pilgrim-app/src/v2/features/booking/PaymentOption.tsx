import { StyleSheet, View } from 'react-native';

import { useColors } from '../../design/theme';
import { radius, space } from '../../design/tokens';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';

export function PaymentOption({
  hint,
  icon,
  onPress,
  selected,
  title,
}: {
  hint: string;
  icon: IconName;
  onPress: () => void;
  selected: boolean;
  title: string;
}) {
  const colors = useColors();

  return (
    <PressableScale
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      pressedScale={0.985}
      style={[
        styles.card,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.line,
        },
      ]}
      onPress={onPress}
    >
      <Icon color={selected ? 'primary' : 'inkMuted'} name={icon} size={22} />
      <View style={styles.copy}>
        <Text variant="heading">{title}</Text>
        <Text color="inkMuted" variant="caption">
          {hint}
        </Text>
      </View>
      <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.line }]}>
        {selected ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
  },
  copy: { flex: 1, gap: 2 },
  dot: { borderRadius: radius.pill, height: 12, width: 12 },
  radio: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
});
