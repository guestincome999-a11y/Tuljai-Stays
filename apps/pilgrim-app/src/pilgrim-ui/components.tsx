import { MaterialCommunityIcons } from '@expo/vector-icons';
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

export const ui = {
  bell: '#C98B17',
  canvas: '#FAF7F2',
  danger: '#C0392B',
  green: '#4A7C59',
  ink: '#2B2320',
  maroon: '#7A1F2B',
  muted: '#817267',
  saffron: '#E67E22',
  saffronDeep: '#C96818',
  success: '#4A7C59',
  surface: '#FFFFFF',
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
