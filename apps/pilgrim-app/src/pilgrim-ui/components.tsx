import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette } from '@tuljai/ui';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  type PressableProps,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatRupees, type BookingStatus, type PilgrimLodge } from './mock-data';
import { usePilgrimApp } from './PilgrimAppProvider';

export type PilgrimIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// These values previously duplicated the shared @tuljai/ui palette by hand
// (they matched exactly); now sourced directly so the two can't drift apart.
export const ui = {
  bell: palette.bell[600],
  canvas: palette.warm[50],
  danger: palette.red[500],
  green: palette.green[500],
  ink: palette.warm[900],
  maroon: palette.maroon[700],
  muted: palette.warm[600],
  saffron: palette.saffron[500],
  saffronDeep: palette.saffron[600],
  success: palette.green[500],
  surface: palette.warm[0],
} as const;

export function AppScreen({
  children,
  scroll = true,
  padded = true,
  className = '',
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  scroll?: boolean;
}) {
  const contentClass = `${padded ? 'px-5' : ''} ${className}`;
  return (
    <SafeAreaView className="flex-1 bg-warm-50" edges={['top']}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName={`${contentClass} pb-32`}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View className={`flex-1 ${contentClass}`}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function BrandMark({
  compact = false,
  inverse = false,
}: {
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View
        className={`${compact ? 'h-10 w-10 rounded-2xl' : 'h-14 w-14 rounded-3xl'} items-center justify-center ${inverse ? 'bg-white/15' : 'bg-saffron-100'}`}
      >
        <MaterialCommunityIcons
          color={inverse ? '#FFF6E8' : ui.saffronDeep}
          name="temple-hindu"
          size={compact ? 24 : 32}
        />
      </View>
      <View>
        <Text
          className={`${compact ? 'text-xl' : 'text-2xl'} font-extrabold tracking-tight ${inverse ? 'text-white' : 'text-warm-900'}`}
        >
          Tuljai Stays
        </Text>
        {!compact ? (
          <Text
            className={`mt-0.5 text-xs font-semibold ${inverse ? 'text-orange-100' : 'text-maroon-700'}`}
          >
            तुळजाई स्टेज · Tuljapur
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function LanguageToggle({ inverse = false }: { inverse?: boolean }) {
  const { language, setLanguage } = usePilgrimApp();
  return (
    <View className={`flex-row rounded-full p-1 ${inverse ? 'bg-white/15' : 'bg-warm-100'}`}>
      {(['en', 'mr'] as const).map((item) => {
        const active = language === item;
        return (
          <Pressable
            accessibilityLabel={item === 'en' ? 'Use English' : 'मराठी वापरा'}
            accessibilityRole="button"
            className={`min-h-9 min-w-10 items-center justify-center rounded-full px-2 ${active ? 'bg-white' : ''}`}
            key={item}
            onPress={() => setLanguage(item)}
          >
            <Text
              className={`text-xs font-bold ${active ? 'text-maroon-700' : inverse ? 'text-white' : 'text-warm-600'}`}
            >
              {item === 'en' ? 'EN' : 'मरा'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TopBar({
  title,
  subtitle,
  onBack,
  right,
}: {
  onBack?: () => void;
  right?: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <View className="mb-5 mt-2 flex-row items-center gap-3">
      {onBack ? (
        <IconButton accessibilityLabel="Go back" icon="chevron-left" onPress={onBack} />
      ) : null}
      <View className="min-w-0 flex-1">
        <Text className="text-2xl font-extrabold tracking-tight text-warm-900" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text className="mt-0.5 text-sm text-warm-500">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function IconButton({
  icon,
  tone = 'light',
  ...props
}: Omit<PressableProps, 'children'> & {
  icon: PilgrimIconName;
  tone?: 'light' | 'saffron' | 'white';
}) {
  const background =
    tone === 'saffron' ? 'bg-saffron-500' : tone === 'white' ? 'bg-white' : 'bg-warm-100';
  const color = tone === 'saffron' ? '#FFFFFF' : ui.ink;
  return (
    <Pressable
      accessibilityRole="button"
      className={`h-12 w-12 items-center justify-center rounded-2xl ${background} active:opacity-75`}
      {...props}
    >
      <MaterialCommunityIcons color={color} name={icon} size={23} />
    </Pressable>
  );
}

export function PrimaryButton({
  children,
  icon,
  loading = false,
  disabled = false,
  className = '',
  ...props
}: PressableProps & {
  children: ReactNode;
  className?: string;
  icon?: PilgrimIconName;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-14 flex-row items-center justify-center gap-2 rounded-2xl px-5 ${disabled ? 'bg-warm-300' : 'bg-saffron-500 active:bg-saffron-600'} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : icon ? (
        <MaterialCommunityIcons color="#FFFFFF" name={icon} size={21} />
      ) : null}
      <Text className="text-base font-extrabold text-white">{children}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  children,
  icon,
  destructive = false,
  className = '',
  ...props
}: PressableProps & {
  children: ReactNode;
  className?: string;
  destructive?: boolean;
  icon?: PilgrimIconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-13 flex-row items-center justify-center gap-2 rounded-2xl border px-5 active:bg-warm-100 ${destructive ? 'border-danger-100 bg-danger-50' : 'border-warm-200 bg-white'} ${className}`}
      {...props}
    >
      {icon ? (
        <MaterialCommunityIcons color={destructive ? ui.danger : ui.maroon} name={icon} size={20} />
      ) : null}
      <Text
        className={`text-sm font-extrabold ${destructive ? 'text-danger-500' : 'text-maroon-700'}`}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  icon,
  className = '',
  ...props
}: TextInputProps & { className?: string; icon?: PilgrimIconName; label: string }) {
  return (
    <View className={className}>
      <Text className="mb-2 text-sm font-bold text-warm-700">{label}</Text>
      <View className="min-h-14 flex-row items-center gap-3 rounded-2xl border border-warm-200 bg-white px-4 focus:border-saffron-500">
        {icon ? <MaterialCommunityIcons color={ui.muted} name={icon} size={21} /> : null}
        <TextInput
          className="min-h-14 flex-1 text-base font-medium text-warm-900"
          placeholderTextColor={ui.muted}
          {...props}
        />
      </View>
    </View>
  );
}

export function SearchBox({
  value,
  onChangeText,
  onPress,
  placeholder = 'Search by lodge or area',
}: {
  onChangeText?: (value: string) => void;
  onPress?: () => void;
  placeholder?: string;
  value?: string;
}) {
  const shell = (
    <View className="min-h-14 flex-row items-center gap-3 rounded-2xl border border-warm-200 bg-white px-4 shadow-sm shadow-warm-900/5">
      <MaterialCommunityIcons color={ui.saffronDeep} name="magnify" size={23} />
      {onPress ? (
        <Text className="flex-1 text-base font-medium text-warm-500">{placeholder}</Text>
      ) : (
        <TextInput
          className="min-h-14 flex-1 text-base font-medium text-warm-900"
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={ui.muted}
          value={value}
        />
      )}
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-saffron-50">
        <MaterialCommunityIcons color={ui.saffronDeep} name="tune-variant" size={19} />
      </View>
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {shell}
    </Pressable>
  ) : (
    shell
  );
}

export function SectionTitle({
  title,
  action,
  onAction,
  subtitle,
}: {
  action?: string;
  onAction?: () => void;
  subtitle?: string;
  title: string;
}) {
  return (
    <View className="flex-row items-end justify-between gap-3">
      <View className="min-w-0 flex-1">
        <Text className="text-xl font-extrabold tracking-tight text-warm-900">{title}</Text>
        {subtitle ? <Text className="mt-1 text-sm leading-5 text-warm-500">{subtitle}</Text> : null}
      </View>
      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          className="min-h-11 justify-center"
          onPress={onAction}
        >
          <Text className="text-sm font-extrabold text-saffron-700">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function LodgeCard({
  lodge,
  favorite,
  horizontal = false,
  onPress,
  onFavorite,
}: {
  favorite: boolean;
  horizontal?: boolean;
  lodge: PilgrimLodge;
  onFavorite: () => void;
  onPress: () => void;
}) {
  const { t } = usePilgrimApp();
  if (horizontal) {
    return (
      <View className="relative mr-4 w-72 overflow-hidden rounded-3xl border border-warm-100 bg-white shadow-sm shadow-warm-900/10">
        <Pressable accessibilityRole="button" onPress={onPress}>
          <View className="relative h-44">
            <Image className="h-full w-full" resizeMode="cover" source={{ uri: lodge.hero }} />
            {lodge.badge ? (
              <Text className="absolute bottom-3 left-3 rounded-full bg-maroon-700 px-3 py-1.5 text-xs font-bold text-white">
                {lodge.badge}
              </Text>
            ) : null}
          </View>
          <View className="gap-2 p-4">
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 text-base font-extrabold text-warm-900" numberOfLines={1}>
                {lodge.name}
              </Text>
              <Rating rating={lodge.rating} />
            </View>
            <Text className="text-sm text-warm-500">{lodge.distance}</Text>
            <View className="flex-row items-end">
              <Text className="text-lg font-extrabold text-maroon-700">
                {formatRupees(lodge.price)}
              </Text>
              <Text className="mb-0.5 text-xs text-warm-500">{t(' / night', ' / रात्र')}</Text>
            </View>
          </View>
        </Pressable>
        <FavoriteButton favorite={favorite} onPress={onFavorite} />
      </View>
    );
  }

  return (
    <View className="relative overflow-hidden rounded-3xl border border-warm-100 bg-white shadow-sm shadow-warm-900/10">
      <Pressable accessibilityRole="button" onPress={onPress}>
        <View className="relative h-48">
          <Image className="h-full w-full" resizeMode="cover" source={{ uri: lodge.hero }} />
          <View className="absolute bottom-3 left-3 flex-row gap-2">
            <Text className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-extrabold text-templeGreen-700">
              ✓ {t('Verified stay', 'सत्यापित निवास')}
            </Text>
            {lodge.badge ? (
              <Text className="rounded-full bg-maroon-700 px-3 py-1.5 text-xs font-bold text-white">
                {lodge.badge}
              </Text>
            ) : null}
          </View>
        </View>
        <View className="gap-2 p-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-lg font-extrabold text-warm-900" numberOfLines={1}>
                {lodge.name}
              </Text>
              <Text className="mt-1 text-sm text-warm-500">
                {lodge.type} · {lodge.location}
              </Text>
            </View>
            <Rating rating={lodge.rating} />
          </View>
          <View className="flex-row items-center justify-between gap-3 border-t border-warm-100 pt-3">
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons color={ui.saffronDeep} name="temple-hindu" size={17} />
              <Text className="text-sm font-semibold text-warm-600">{lodge.distance}</Text>
            </View>
            <View className="flex-row items-end">
              <Text className="text-xl font-extrabold text-maroon-700">
                {formatRupees(lodge.price)}
              </Text>
              <Text className="mb-1 text-xs text-warm-500">{t(' / night', ' / रात्र')}</Text>
            </View>
          </View>
        </View>
      </Pressable>
      <FavoriteButton favorite={favorite} onPress={onFavorite} />
    </View>
  );
}

function FavoriteButton({ favorite, onPress }: { favorite: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={favorite ? 'Remove from saved stays' : 'Save this stay'}
      accessibilityRole="button"
      className="absolute right-3 top-3 h-11 w-11 items-center justify-center rounded-full bg-white/95"
      hitSlop={8}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
    >
      <MaterialCommunityIcons
        color={favorite ? ui.maroon : ui.ink}
        name={favorite ? 'heart' : 'heart-outline'}
        size={23}
      />
    </Pressable>
  );
}

export function Rating({ rating }: { rating: number }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-bell-50 px-2.5 py-1.5">
      <MaterialCommunityIcons color={ui.bell} name="star" size={15} />
      <Text className="text-xs font-extrabold text-warm-900">{rating.toFixed(1)}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { t } = usePilgrimApp();
  const styles: Record<
    BookingStatus,
    { icon: PilgrimIconName; label: string; shell: string; text: string }
  > = {
    cancelled: {
      icon: 'close-circle',
      label: t('Cancelled', 'रद्द'),
      shell: 'bg-danger-50',
      text: 'text-danger-700',
    },
    completed: {
      icon: 'check-decagram',
      label: t('Completed', 'पूर्ण'),
      shell: 'bg-warm-100',
      text: 'text-warm-600',
    },
    'checked-in': {
      icon: 'account-check',
      label: t('Checked in', 'चेक-इन पूर्ण'),
      shell: 'bg-templeGreen-50',
      text: 'text-templeGreen-700',
    },
    confirmed: {
      icon: 'check-circle',
      label: t('Confirmed', 'पुष्टी'),
      shell: 'bg-templeGreen-50',
      text: 'text-templeGreen-700',
    },
    pending: {
      icon: 'clock-outline',
      label: t('Awaiting lodge', 'लॉजच्या प्रतीक्षेत'),
      shell: 'bg-bell-50',
      text: 'text-bell-700',
    },
  };
  const item = styles[status];
  const color =
    status === 'confirmed' || status === 'checked-in'
      ? ui.green
      : status === 'cancelled'
        ? ui.danger
        : status === 'pending'
          ? palette.bell[700]
          : ui.muted;
  return (
    <View
      className={`flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5 ${item.shell}`}
    >
      <MaterialCommunityIcons color={color} name={item.icon} size={15} />
      <Text className={`text-xs font-extrabold ${item.text}`}>{item.label}</Text>
    </View>
  );
}

export function InfoRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: PilgrimIconName;
  label: string;
  last?: boolean;
  value: string;
}) {
  return (
    <View
      className={`flex-row items-center gap-3 py-3.5 ${last ? '' : 'border-b border-warm-100'}`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-saffron-50">
        <MaterialCommunityIcons color={ui.saffronDeep} name={icon} size={20} />
      </View>
      <View className="flex-1">
        <Text className="text-xs font-semibold text-warm-500">{label}</Text>
        <Text className="mt-0.5 text-sm font-bold text-warm-900">{value}</Text>
      </View>
    </View>
  );
}

export function SettingRow({
  icon,
  label,
  subtitle,
  onPress,
  right,
  destructive = false,
}: {
  destructive?: boolean;
  icon: PilgrimIconName;
  label: string;
  onPress?: () => void;
  right?: ReactNode;
  subtitle?: string;
}) {
  const content = (
    <>
      <View
        className={`h-11 w-11 items-center justify-center rounded-2xl ${destructive ? 'bg-danger-50' : 'bg-saffron-50'}`}
      >
        <MaterialCommunityIcons
          color={destructive ? ui.danger : ui.saffronDeep}
          name={icon}
          size={22}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className={`text-base font-bold ${destructive ? 'text-danger-500' : 'text-warm-900'}`}
        >
          {label}
        </Text>
        {subtitle ? <Text className="mt-0.5 text-xs text-warm-500">{subtitle}</Text> : null}
      </View>
      {right ??
        (onPress ? (
          <MaterialCommunityIcons color={ui.muted} name="chevron-right" size={22} />
        ) : null)}
    </>
  );

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      className="min-h-16 flex-row items-center gap-3 border-b border-warm-100 py-3 active:bg-warm-50"
      onPress={onPress}
    >
      {content}
    </Pressable>
  ) : (
    <View className="min-h-16 flex-row items-center gap-3 border-b border-warm-100 py-3">
      {content}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  action?: string;
  body: string;
  icon: PilgrimIconName;
  onAction?: () => void;
  title: string;
}) {
  return (
    <View className="items-center rounded-3xl border border-warm-100 bg-white px-7 py-12">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-saffron-50">
        <MaterialCommunityIcons color={ui.saffronDeep} name={icon} size={38} />
      </View>
      <Text className="mt-5 text-center text-xl font-extrabold text-warm-900">{title}</Text>
      <Text className="mt-2 text-center text-sm leading-5 text-warm-500">{body}</Text>
      {action && onAction ? (
        <PrimaryButton className="mt-6" onPress={onAction}>
          {action}
        </PrimaryButton>
      ) : null}
    </View>
  );
}

export function LoadingList({ label }: { label: string }) {
  return (
    <View accessibilityLabel={label} className="gap-4">
      {[0, 1].map((item) => (
        <View className="overflow-hidden rounded-3xl border border-warm-100 bg-white" key={item}>
          <View className="h-36 bg-warm-200" />
          <View className="gap-3 p-4">
            <View className="h-5 w-2/3 rounded-full bg-warm-200" />
            <View className="h-4 w-1/2 rounded-full bg-warm-100" />
            <View className="h-12 rounded-2xl bg-warm-100" />
          </View>
        </View>
      ))}
    </View>
  );
}
