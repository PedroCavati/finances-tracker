import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMonth } from '@/lib/dates';

/** "‹ Novembro de 2026 ›". Tocar no nome volta para o mês atual. */
export function MonthSwitcher({
  monthStart,
  onMove,
  onReset,
}: {
  /** Primeiro dia do mês exibido, "2026-11-01". */
  monthStart: string;
  /** -1 para o mês anterior, +1 para o próximo. */
  onMove: (delta: -1 | 1) => void;
  onReset: () => void;
}) {
  return (
    <View style={styles.row}>
      <Arrow direction="left" onPress={() => onMove(-1)} />
      <Pressable onPress={onReset} accessibilityLabel="Voltar para o mês atual">
        <ThemedText type="smallBold">{formatMonth(monthStart)}</ThemedText>
      </Pressable>
      <Arrow direction="right" onPress={() => onMove(1)} />
    </View>
  );
}

function Arrow({ direction, onPress }: { direction: 'left' | 'right'; onPress: () => void }) {
  const theme = useTheme();
  const name =
    direction === 'left'
      ? ({ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' } as const)
      : ({ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' } as const);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === 'left' ? 'Mês anterior' : 'Próximo mês'}
      hitSlop={12}
      onPress={onPress}
      style={styles.arrow}>
      <SymbolView name={name} size={16} tintColor={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrow: {
    padding: Spacing.one,
  },
});