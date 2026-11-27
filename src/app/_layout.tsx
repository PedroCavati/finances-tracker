import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { migrate } from '@/db/migrations';
import { configureNotifications } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();
configureNotifications();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...navTheme,
        colors: { ...navTheme.colors, primary: colors.tint, background: colors.background },
      }}>
      <KeyboardProvider>
        <Suspense fallback={null}>
          <SQLiteProvider databaseName="finances.db" onInit={migrate} useSuspense>
            <Stack screenOptions={{ headerTintColor: colors.tint }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="transaction" options={{ presentation: 'modal' }} />
              <Stack.Screen name="account" options={{ presentation: 'modal' }} />
              <Stack.Screen name="category" options={{ presentation: 'modal' }} />
            </Stack>
          </SQLiteProvider>
        </Suspense>
      </KeyboardProvider>
      <AnimatedSplashOverlay />
    </ThemeProvider>
  );
}
