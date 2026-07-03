import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { darkPalette, lightPalette } from './tokens';

export const tuljaiLightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...lightPalette,
  },
};

export const tuljaiDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...darkPalette,
  },
};
