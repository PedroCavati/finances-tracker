import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Situação de uma categoria em relação ao limite. */
export type BudgetLevel = 'ok' | 'warning' | 'over';

/** "ok" abaixo de 80%, "warning" de 80% até o limite, "over" acima do limite. */
export function budgetLevel(spent: number, budget: number): BudgetLevel {
  if (spent > budget) return 'over';
  if (spent >= budget * 0.8) return 'warning';
  return 'ok';
}

/** Cor do tema para cada nível. */
export function useBudgetColor(level: BudgetLevel) {
  const theme = useTheme();
  return level === 'over' ? theme.expense : level === 'warning' ? theme.warning : theme.tint;
}

/**
 * Barra de progresso do orçamento. Só use quando houver limite (budget > 0).
 * `committed` (previsto) aparece depois do gasto, na mesma cor e mais clara.
 * A cor segue só o gasto real: o previsto ainda pode não acontecer.
 */
export function BudgetBar({ spent, budget, committed = 0 }: { spent: number; budget: number; committed?: number }) {
  const theme = useTheme();
  const color = useBudgetColor(budgetLevel(spent, budget));
  const percent = Math.round((spent / budget) * 100);
  const spentWidth = Math.min(spent / budget, 1) * 100;
  const committedWidth = Math.min((spent + committed) / budget, 1) * 100 - spentWidth;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.fill, { width: `${spentWidth}%`, backgroundColor: color }]} />
      {committedWidth > 0 && (
        <View style={[styles.fill, styles.committed, { width: `${committedWidth}%`, backgroundColor: color }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
    track: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  committed: {
    opacity: 0.35,
  },
});