import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { TransactionRow as Row } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { formatDayLabel } from '@/lib/dates';
import { formatSignedMoney } from '@/lib/money';

/** Lista de lançamentos agrupada por dia, com o total do dia (sem transferências). */
export function TransactionList({ items, accountId }: { items: Row[]; accountId?: number }) {
  const theme = useTheme();
  const groups: { date: string; items: Row[]; net: number }[] = [];
  for (const item of items) {
    let group = groups[groups.length - 1];
    if (!group || group.date !== item.date) {
      group = { date: item.date, items: [], net: 0 };
      groups.push(group);
    }
    group.items.push(item);
    if (item.kind === 'income') group.net += item.amount;
    if (item.kind === 'expense') group.net -= item.amount;
  }

  return (
    <View style={styles.list}>
      {groups.map((group) => (
        <View key={group.date} style={styles.group}>
          <View style={styles.groupHeader}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {formatDayLabel(group.date)}
            </ThemedText>
            {group.net !== 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.tabular}>
                {formatSignedMoney(group.net)}
              </ThemedText>
            )}
          </View>
          <Card style={styles.card}>
            {group.items.map((item, index) => (
              <Fragment key={item.id}>
                {index > 0 && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
                <TransactionRow item={item} accountId={accountId} />
              </Fragment>
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  group: {
    gap: Spacing.two,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  card: {
    paddingVertical: Spacing.one,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
