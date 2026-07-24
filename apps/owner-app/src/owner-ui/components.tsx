import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type PressableProps,
  type ScrollViewProps,
} from 'react-native';

import { useOwnerApp } from './OwnerAppProvider';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Screen({ children, ...props }: PropsWithChildren<ScrollViewProps>) {
  return (
    <ScrollView
      className="flex-1 bg-warm-50"
      contentContainerClassName="gap-5 px-4 pb-32 pt-4"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <View className="flex-1 gap-1">
        <Text className="font-heading text-2xl font-bold text-warm-900">{title}</Text>
        {subtitle ? (
          <Text className="font-body text-sm leading-5 text-warm-600">{subtitle}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <View className={`rounded-2xl border border-warm-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="font-heading text-lg font-bold text-warm-900">{title}</Text>
      {action}
    </View>
  );
}

export function PrimaryButton({
  label,
  icon,
  className = '',
  ...props
}: PressableProps & { label: string; icon?: IconName; className?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl bg-saffron-500 px-5 active:bg-saffron-600 ${className}`}
      {...props}
    >
      {icon ? <MaterialCommunityIcons color="#2B2320" name={icon} size={21} /> : null}
      <Text className="font-heading text-base font-bold text-warm-900">{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  icon,
  destructive = false,
  className = '',
  ...props
}: PressableProps & { label: string; icon?: IconName; destructive?: boolean; className?: string }) {
  const color = destructive ? '#C0392B' : '#7A1F2B';
  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl border bg-white px-5 active:bg-warm-100 ${destructive ? 'border-danger-500' : 'border-maroon-700'} ${className}`}
      {...props}
    >
      {icon ? <MaterialCommunityIcons color={color} name={icon} size={21} /> : null}
      <Text
        className={`font-heading text-base font-bold ${destructive ? 'text-danger-500' : 'text-maroon-700'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="h-12 w-12 items-center justify-center rounded-xl bg-saffron-100"
      onPress={onPress}
    >
      <MaterialCommunityIcons color="#7A1F2B" name={icon} size={24} />
    </Pressable>
  );
}

export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const styles = {
    success: 'bg-templeGreen-50 text-templeGreen-700',
    warning: 'bg-bell-50 text-bell-800',
    danger: 'bg-danger-50 text-danger-700',
    neutral: 'bg-warm-100 text-warm-700',
  };
  return (
    <Text
      className={`self-start rounded-full px-3 py-1.5 font-body text-xs font-bold ${styles[tone]}`}
    >
      {label}
    </Text>
  );
}

export function LanguagePill() {
  const { language, setLanguage } = useOwnerApp();
  return (
    <Pressable
      accessibilityRole="button"
      className="min-h-12 min-w-16 items-center justify-center rounded-xl border border-warm-200 bg-white px-3"
      onPress={() => setLanguage(language === 'en' ? 'mr' : 'en')}
    >
      <Text className="font-devanagari text-sm font-bold text-maroon-700">
        {language === 'en' ? 'मराठी' : 'English'}
      </Text>
    </Pressable>
  );
}

export function Divider() {
  return <View className="h-px bg-warm-200" />;
}
