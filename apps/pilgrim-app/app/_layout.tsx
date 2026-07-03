import { tuljaiDarkTheme, tuljaiLightTheme } from '@tuljai/ui';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tuljaiDarkTheme : tuljaiLightTheme;

  return (
    <PaperProvider theme={theme}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTitleStyle: { color: theme.colors.onSurface },
          headerTintColor: theme.colors.primary,
        }}
      />
    </PaperProvider>
  );
}
