import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useId, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { PilgrimIconName } from '../components';

/**
 * Home screen design tokens. Gradients are drawn with react-native-svg (already
 * bundled), so the new look needs no extra native module and ships over the air.
 */
export const home = {
  ink: '#1F1A17',
  line: '#EFE6DC',
  muted: '#7B6E65',
  primary: '#F0561D',
  primarySoft: '#FFF0E6',
  sunrise: ['#FFA24A', '#F0561D', '#C23A1B'] as GradientStops,
  sunriseSoft: ['#FFB067', '#F0561D'] as GradientStops,
  surface: '#FFFFFF',
} as const;

export type GradientStops = ReadonlyArray<string | readonly [string, number]>;

export function Gradient({
  children,
  colors,
  direction = 'diagonal',
  style,
}: {
  children?: ReactNode;
  colors: GradientStops;
  direction?: 'diagonal' | 'down' | 'right';
  style?: StyleProp<ViewStyle>;
}) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [x2, y2] = direction === 'down' ? [0, 1] : direction === 'right' ? [1, 0] : [1, 1];
  const last = Math.max(colors.length - 1, 1);

  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <Svg height="100%" preserveAspectRatio="none" style={StyleSheet.absoluteFill} width="100%">
        <Defs>
          <LinearGradient id={id} x1="0" x2={String(x2)} y1="0" y2={String(y2)}>
            {colors.map((stop, index) => {
              const [color, opacity] = typeof stop === 'string' ? [stop, 1] : stop;
              return (
                <Stop
                  key={`${color}-${index}`}
                  offset={`${(index / last) * 100}%`}
                  stopColor={color}
                  stopOpacity={opacity}
                />
              );
            })}
          </LinearGradient>
        </Defs>
        <Rect fill={`url(#${id})`} height="100%" width="100%" />
      </Svg>
      {children}
    </View>
  );
}

export function GradientButton({
  icon,
  label,
  onPress,
  tone = 'brand',
}: {
  icon?: PilgrimIconName;
  label: string;
  onPress: () => void;
  tone?: 'brand' | 'light';
}) {
  const light = tone === 'light';
  const content = (
    <View className="h-11 flex-row items-center justify-center gap-1.5 px-5">
      <Text className={`text-[14px] font-bold ${light ? 'text-[#C23A1B]' : 'text-white'}`}>
        {label}
      </Text>
      {icon ? (
        <MaterialCommunityIcons color={light ? '#C23A1B' : '#FFFFFF'} name={icon} size={16} />
      ) : null}
    </View>
  );

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      {light ? (
        <View className="overflow-hidden rounded-full bg-white">{content}</View>
      ) : (
        <Gradient
          colors={home.sunriseSoft}
          direction="right"
          style={{ borderRadius: 999, elevation: 3 }}
        >
          {content}
        </Gradient>
      )}
    </Pressable>
  );
}

/** Small round icon chip — intentionally compact (36px circle, 18px glyph). */
export function IconChip({
  color = home.primary,
  icon,
  size = 36,
  tint = home.primarySoft,
}: {
  color?: string;
  icon: PilgrimIconName;
  size?: number;
  tint?: string;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: tint,
        borderRadius: size / 2,
        height: size,
        justifyContent: 'center',
        width: size,
      }}
    >
      <MaterialCommunityIcons color={color} name={icon} size={Math.round(size * 0.5)} />
    </View>
  );
}

export function HomeSectionHeader({
  actionLabel,
  onAction,
  subtitle,
  title,
}: {
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
  title: string;
}) {
  return (
    <View className="flex-row items-end justify-between gap-3">
      <View className="min-w-0 flex-1">
        <Text className="text-[19px] font-extrabold tracking-tight text-warm-900">{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-[13px] text-warm-500">{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          className="flex-row items-center py-2 active:opacity-60"
          hitSlop={8}
          onPress={onAction}
        >
          <Text className="text-[13px] font-bold" style={{ color: home.primary }}>
            {actionLabel}
          </Text>
          <MaterialCommunityIcons color={home.primary} name="chevron-right" size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}
