import { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '../design/theme';
import { radius } from '../design/tokens';

export function Skeleton({
  height,
  rounded = radius.md,
  style,
  width = '100%',
}: {
  height: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
  width?: DimensionValue;
}) {
  const colors = useColors();
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        { backgroundColor: colors.line, borderRadius: rounded, height, width },
        animatedStyle,
        style,
      ]}
    />
  );
}
