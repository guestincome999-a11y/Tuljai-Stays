import * as Haptics from 'expo-haptics';
import { Pressable } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /** Light tick on press-in. Keep for primary actions only. */
  haptic?: boolean;
  pressedScale?: number;
  style?: StyleProp<ViewStyle>;
}

export function PressableScale({
  haptic = false,
  onPressIn,
  onPressOut,
  pressedScale = 0.97,
  style,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        scale.value = withTiming(pressedScale, { duration: 90 });
        if (haptic) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withTiming(1, { duration: 140 });
        onPressOut?.(event);
      }}
    />
  );
}
