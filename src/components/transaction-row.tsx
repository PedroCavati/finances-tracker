import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { TransactionRow as Row } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';

/** Linha de um lançamento. Com `accountId`, transferências mostram o sinal de entrada ou saída daquela conta. */
export function TransactionRow({ item, accountId }: { item: Row; accountId?: number }) {
  const theme = useTheme();

  const isTransfer = item.kind === 'transfer';
  // Vista de uma conta específica: transferência recebida aparece como entrada.
  const incoming = item.kind === 'income' || (isTransfer && accountId === item.to_account_id);
  const color = isTransfer ? theme.transfer : item.kind === 'income' ? theme.income : theme.text;
  const sign = isTransfer && !accountId ? '' : incoming ? '+' : '−';

  const category = item.category_name
    ? item.parent_category_name
      ? `${item.parent_category_name} › ${item.category_name}`
      : item.category_name
    : null;
  const title = item.description || (isTransfer ? 'Transferência' : (category ?? 'Sem categoria'));
  const subtitle = isTransfer
    ? `${item.account_name} → ${item.to_account_name}`
    : [item.description ? category : null, item.account_name].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sign}${formatMoney(item.amount)}`}
      onPress={() => router.push({ pathname: '/transaction', params: { id: String(item.id) } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <Badge
        icon={isTransfer ? 'bank' : item.category_icon}
        color={isTransfer ? theme.transfer : item.category_color}
      />
      <View style={styles.text}>
        <ThemedText numberOfLines={1}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>
      <ThemedText style={[styles.amount, { color }]}>
        {sign}
        {formatMoney(item.amount)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: Spacing.two,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  amount: {
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
});
