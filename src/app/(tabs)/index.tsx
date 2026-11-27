import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BudgetBar, budgetLevel, useBudgetColor } from '@/components/budget-bar';
import { MonthSwitcher } from '@/components/month-switcher';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { TransactionList } from '@/components/transaction-list';
import { Button, Card, EmptyState, IconButton, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { budgetProgress, listAccounts, listTransactions, periodSummary } from '@/db/queries';
import type { BudgetProgress } from '@/db/types';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { monthKey, monthRange, today } from '@/lib/dates';
import { formatMoney, formatSignedMoney } from '@/lib/money';

export default function HomeScreen() {
  const theme = useTheme();
  const now = today();
  const [monthOffset, setMonthOffset] = useState(0);
  const month = monthRange(now, monthOffset);

  const { data: accounts } = useQuery((db) => listAccounts(db, now), now);
  const { data: summary } = useQuery(
    (db) => periodSummary(db, month.start, month.end),
    `${month.start}:${month.end}`
  );
  const { data: recent } = useQuery((db) => listTransactions(db, { end: now, limit: 8 }), now);
  const { data: budgets } = useQuery((db) => budgetProgress(db, monthKey(month.start)), `budget:${month.start}`);

  const total = accounts?.reduce((sum, a) => sum + a.balance, 0) ?? 0;
  const net = summary?.net ?? 0;

  const add = (kind: 'expense' | 'income') => router.push({ pathname: '/transaction', params: { kind } });

  return (
    <Screen
      title="Início"
      actions={<IconButton icon={{ ios: 'plus', android: 'add', web: 'add' }} label="Novo lançamento" filled onPress={() => add('expense')} />}>
      <Card style={styles.balanceCard}>
        <ThemedText type="small" themeColor="textSecondary">
          Saldo em todas as contas
        </ThemedText>
        <ThemedText style={[styles.balance, total < 0 && { color: theme.expense }]}>
          {formatMoney(total)}
        </ThemedText>
      </Card>

      <Card style={styles.monthCard}>
        <MonthSwitcher
          monthStart={month.start}
          onMove={(delta) => setMonthOffset((m) => m + delta)}
          onReset={() => setMonthOffset(0)}
        />

        <View style={styles.summaryRow}>
          <SummaryItem label="Receitas" value={formatMoney(summary?.income ?? 0)} color={theme.income} />
          <SummaryItem label="Despesas" value={formatMoney(summary?.expense ?? 0)} color={theme.expense} />
        </View>
        <View style={[styles.netRow, { borderTopColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Resultado do mês
          </ThemedText>
          <ThemedText
            style={[styles.netValue, { color: net > 0 ? theme.income : net < 0 ? theme.expense : theme.text }]}>
            {formatSignedMoney(net)}
          </ThemedText>
        </View>
      </Card>

      <BudgetSummary items={budgets ?? []} />

      <View style={styles.quickActions}>
        <Button title="− Despesa" variant="secondary" style={styles.quickButton} onPress={() => add('expense')} />
        <Button title="+ Receita" variant="secondary" style={styles.quickButton} onPress={() => add('income')} />
      </View>

      <SectionTitle
        right={
          recent && recent.length > 0 ? (
            <Pressable onPress={() => router.navigate('/transactions')} hitSlop={8}>
              <ThemedText type="small" style={{ color: theme.tint }}>
                Ver todos
              </ThemedText>
            </Pressable>
          ) : undefined
        }>
        Últimos lançamentos
      </SectionTitle>

      {recent && recent.length === 0 && (
        <EmptyState
          title="Nenhum lançamento ainda"
          message="Registre sua primeira despesa ou receita para ver o resumo do mês."
        />
      )}
      {recent && recent.length > 0 && <TransactionList items={recent} />}
    </Screen>
  );
}

/** Total do orçamento do mês e as categorias que passaram de 80%. Some se não houver limites. */
function BudgetSummary({ items }: { items: BudgetProgress[] }) {
  const withBudget = items.filter((p) => p.budget > 0);
  if (withBudget.length === 0) return null;

  const totalBudget = withBudget.reduce((sum, p) => sum + p.budget, 0);
  const totalSpent = withBudget.reduce((sum, p) => sum + p.spent, 0);

  // As mais críticas primeiro: maior proporção gasto/limite.
  const attention = withBudget
    .filter((p) => budgetLevel(p.spent, p.budget) !== 'ok')
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget)
    .slice(0, 3);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Orçamento: ${formatMoney(totalSpent)} de ${formatMoney(totalBudget)}`}
      onPress={() => router.navigate('/categories')}
      style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <Card style={styles.budgetCard}>
        <View style={styles.budgetHeader}>
          <ThemedText type="smallBold">Orçamento</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.tabular}>
            {formatMoney(totalSpent)} de {formatMoney(totalBudget)}
          </ThemedText>
        </View>
        <BudgetBar spent={totalSpent} budget={totalBudget} />
        {attention.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Tudo dentro do limite.
          </ThemedText>
        ) : (
          attention.map((p) => <AttentionRow key={p.category_id} item={p} />)
        )}
      </Card>
    </Pressable>
  );
}

function AttentionRow({ item }: { item: BudgetProgress }) {
  const level = budgetLevel(item.spent, item.budget);
  const color = useBudgetColor(level);
  const detail =
    level === 'over'
      ? `${formatMoney(item.spent - item.budget)} acima`
      : `${Math.round((item.spent / item.budget) * 100)}%`;

  return (
    <View style={styles.attentionRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText type="small" style={styles.attentionName} numberOfLines={1}>
        {item.name}
      </ThemedText>
      <ThemedText type="small" style={[styles.tabular, { color }]}>
        {detail}
      </ThemedText>
    </View>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summaryItem}>
      <View style={styles.summaryLabel}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      </View>
      <ThemedText style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    gap: Spacing.one,
  },
  balance: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  monthCard: {
    gap: Spacing.three,
  },
  budgetCard: {
    gap: Spacing.two,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  attentionName: {
    flex: 1,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  summaryItem: {
    flex: 1,
    gap: 2,
  },
  summaryLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryValue: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  netValue: {
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  quickButton: {
    flex: 1,
  },
});
