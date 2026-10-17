import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useColors } from '../design/theme';
import { hitTarget, radius, space } from '../design/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: ButtonVariant;
}

export function Button({
  disabled = false,
  label,
  loading = false,
  onPress,
  style,
  variant = 'primary',
}: ButtonProps) {
  const colors = useColors();
  const inactive = disabled || loading;
  const background =
    variant === 'primary'
      ? colors.primary
      : variant === 'secondary'
        ? colors.primarySoft
        : 'transparent';
  const foreground = variant === 'primary' ? 'onPrimary' : 'primary';

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: inactive }}
      disabled={inactive}
      haptic={variant === 'primary'}
      style={[styles.base, { backgroundColor: background, opacity: disabled ? 0.45 : 1 }, style]}
      onPress={onPress}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors[foreground]} size="small" />
        ) : (
          <Text color={foreground} style={styles.label} variant="label">
            {label}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: hitTarget + space.xs,
    paddingHorizontal: space.xl,
  },
  content: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, lineHeight: 22 },
});
