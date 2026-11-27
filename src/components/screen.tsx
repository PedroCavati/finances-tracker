import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Tela de aba: título grande, ações à direita e conteúdo rolável. */
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

/** Conteúdo rolável dos formulários apresentados como modal. */
/** Conteúdo rolável dos formulários apresentados como modal. */
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
