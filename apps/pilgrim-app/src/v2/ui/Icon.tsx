import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import { useColors } from '../design/theme';
import type { ThemeColors } from '../design/theme';

export type IconName = ComponentProps<typeof Feather>['name'];

/** One consistent line-icon family across the whole app. */
export function Icon({
  color = 'ink',
  name,
  size = 20,
}: {
  color?: keyof ThemeColors;
  name: IconName;
  size?: number;
}) {
  const colors = useColors();
  return <Feather color={colors[color]} name={name} size={size} />;
}
