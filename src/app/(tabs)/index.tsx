import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { TransactionList } from '@/components/transaction-list';
import { Button, Card, EmptyState, IconButton, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listAccounts, listTransactions, periodSummary } from '@/db/queries';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { formatMonth, monthRange, today } from '@/lib/dates';
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
        <View style={styles.monthHeader}>
          <MonthArrow direction="left" onPress={() => setMonthOffset((m) => m - 1)} />
          <Pressable onPress={() => setMonthOffset(0)} accessibilityLabel="Voltar para o mês atual">
            <ThemedText type="smallBold" style={styles.monthTitle}>
              {formatMonth(month.start)}
            </ThemedText>
          </Pressable>
          <MonthArrow direction="right" onPress={() => setMonthOffset((m) => m + 1)} />
        </View>

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

function MonthArrow({ direction, onPress }: { direction: 'left' | 'right'; onPress: () => void }) {
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
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: {
    textTransform: 'capitalize',
  },
  arrow: {
    padding: Spacing.one,
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
