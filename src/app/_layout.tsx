import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { Suspense } from 'react';
import { useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { RecurrenceRunner } from '@/components/recurrence-runner';
import { Colors } from '@/constants/theme';
import { migrate } from '@/db/migrations';
import { configureNotifications } from '@/lib/notifications';
import { runDueRecurrences } from '@/lib/recurrences';

// Antes da primeira tela: prepara as notificações.
configureNotifications();

/** Na abertura do app: primeiro atualiza o banco, depois gera os recorrentes que venceram. */
async function initDatabase(db: SQLiteDatabase) {
  await migrate(db);
  await runDueRecurrences(db);
}

/** Raiz do app: tema, teclado, banco de dados (com as migrações) e a pilha com as abas e os modais. */
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
          <SQLiteProvider databaseName="finances.db" onInit={initDatabase} useSuspense>
            {/* Sem interface: gera os recorrentes quando o app volta para a frente. */}
            <RecurrenceRunner />
            <Stack screenOptions={{ headerTintColor: colors.tint }}>
              {/* Abas (o cabeçalho é de cada aba) */}
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              {/* Formulários, abertos por cima como modal */}
              <Stack.Screen name="transaction" options={{ presentation: 'modal' }} />
              <Stack.Screen name="account" options={{ presentation: 'modal' }} />
              <Stack.Screen name="category" options={{ presentation: 'modal' }} />
              {/* Telas empurradas na pilha. "minimal" mostra só a seta no voltar, sem "(tabs)". */}
              <Stack.Screen name="recurrences" options={{ headerBackButtonDisplayMode: 'minimal' }} />
            </Stack>
          </SQLiteProvider>
        </Suspense>
      </KeyboardProvider>
    </ThemeProvider>
  );
}
