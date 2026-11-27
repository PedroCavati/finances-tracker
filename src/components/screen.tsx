import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
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
export function FormScroll({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: Spacing.three, paddingBottom: insets.bottom + Spacing.five }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic">
      <View style={[styles.inner, { gap: Spacing.four }]}>{children}</View>
    </ScrollView>
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
