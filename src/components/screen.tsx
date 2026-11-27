import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// ─── Telas de aba ─────────────────────────────────────────────────────────────

/**
 * Tela de aba: título grande, ações à direita e conteúdo rolável.
 * No iOS as abas nativas já descontam a barra de status e a barra de abas; no Android, não,
 * então o espaçamento soma as áreas seguras.
 */
export function Screen({
  title,
  actions,
  children,
  ...scrollProps
}: { title: string; actions?: ReactNode; children: ReactNode } & ScrollViewProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        Platform.OS === 'ios'
          ? { paddingTop: Spacing.three, paddingBottom: Spacing.four }
          : {
              paddingTop: insets.top + Spacing.three,
              paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
            },
      ]}
      keyboardShouldPersistTaps="handled"
      {...scrollProps}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <ThemedText style={styles.title} accessibilityRole="header">
            {title}
          </ThemedText>
          {actions && <View style={styles.actions}>{actions}</View>}
        </View>
        {children}
      </View>
    </ScrollView>
  );
}

// ─── Formulários ──────────────────────────────────────────────────────────────

/** Conteúdo rolável dos formulários apresentados como modal. Rola sozinho até o campo em foco. */
export function FormScroll({
  children,
  keyboardAware = true,
}: {
  children: ReactNode;
  /** false desliga a rolagem automática para o campo em foco (ver AmountInput). */
  keyboardAware?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: Spacing.three, paddingBottom: insets.bottom + Spacing.five }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentInsetAdjustmentBehavior="automatic"
      bottomOffset={Spacing.four}
      enabled={keyboardAware}>
      <View style={[styles.inner, { gap: Spacing.four }]}>{children}</View>
    </KeyboardAwareScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 700,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
