import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

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

/** Barra de progresso do orçamento. Só use quando houver limite (budget > 0). */
export function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  const theme = useTheme();
  const color = useBudgetColor(budgetLevel(spent, budget));
  const percent = Math.round((spent / budget) * 100);
  const width = `${Math.min(percent, 100)}%` as const;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.fill, { width, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});