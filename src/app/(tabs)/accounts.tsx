import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, EmptyState, IconButton, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listAccounts } from '@/db/queries';
import { ACCOUNT_TYPE_LABELS, type AccountWithBalance } from '@/db/types';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { today } from '@/lib/dates';
import { listCardBills, type CardBill } from '@/lib/card-bills';
import { describeBill, type Bill } from '@/lib/credit-card';
import { formatMoney } from '@/lib/money';

// ─── Tela ─────────────────────────────────────────────────────────────────────

/**
 * Aba Contas: saldo de cada conta e o total. Cartões com fatura mostram quanto falta pagar
 * da fatura atual. Tocar num cartão abre a tela de faturas; nas outras contas, o formulário.
 */
export default function AccountsScreen() {
  const theme = useTheme();
  const date = today();

  // Dados do banco (inclui as arquivadas)
  const { data: accounts } = useQuery((db) => listAccounts(db, date, true), date);
  const { data: cardBills } = useQuery((db) => listCardBills(db, date), `bills:${date}`);
  const bills = new Map((cardBills ?? []).map((b) => [b.card.id, b]));

  // Valores calculados. O total só soma as contas ativas.
  const active = accounts?.filter((a) => !a.archived) ?? [];
  const archived = accounts?.filter((a) => a.archived) ?? [];
  const total = active.reduce((sum, a) => sum + a.balance, 0);

  // Ações
  const newAccount = () => router.push('/account');

  return (
    <Screen
      title="Contas"
      actions={<IconButton icon={{ ios: 'plus', android: 'add', web: 'add' }} label="Nova conta" onPress={newAccount} filled />}>
      {/* Saldo total */}
      <Card style={styles.totalCard}>
        <ThemedText type="small" themeColor="textSecondary">
          Saldo total
        </ThemedText>
        <ThemedText style={[styles.total, { color: total < 0 ? theme.expense : theme.text }]}>
          {formatMoney(total)}
        </ThemedText>
      </Card>

      {/* Contas ativas */}
      {accounts && active.length === 0 && (
        <EmptyState
          title="Nenhuma conta"
          message="Crie uma conta para começar a registrar seus lançamentos."
          action={<Button title="Criar conta" onPress={newAccount} />}
        />
      )}

      {active.length > 0 && <AccountGroup accounts={active} bills={bills} />}

      {/* Contas arquivadas */}
      {archived.length > 0 && (
        <>
          <SectionTitle>Arquivadas</SectionTitle>
          <AccountGroup accounts={archived} />
        </>
      )}
    </Screen>
  );
}

// ─── Lista ────────────────────────────────────────────────────────────────────

/** Card com as contas de um grupo, separadas por linhas. Tocar numa abre a edição. */
function AccountGroup({
  accounts,
  bills = new Map(),
}: {
  accounts: AccountWithBalance[];
  /** Fatura atual de cada cartão, pelo id da conta. */
  bills?: Map<number, CardBill>;
}) {
  const theme = useTheme();
  return (
    <Card style={styles.list}>
      {accounts.map((account, index) => (
        <Fragment key={account.id}>
          {index > 0 && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              // Cartão abre a tela de faturas (que tem "Editar"); as outras contas, o formulário.
              router.push({
                pathname: account.type === 'credit_card' ? '/card' : '/account',
                params: { id: String(account.id) },
              })
            }
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }, account.archived ? { opacity: 0.6 } : null]}>
            <Badge icon={account.icon} color={account.color} />
            <AccountRowContent account={account} bill={bills.get(account.id)?.bill} />
          </Pressable>
        </Fragment>
      ))}
    </Card>
  );
}

/**
 * Nome, descrição e valor de uma conta. Cartão com fatura: a situação da fatura e quanto
 * falta pagar dela (em vermelho se venceu). Outras contas: o tipo e o saldo.
 */
function AccountRowContent({ account, bill }: { account: AccountWithBalance; bill?: Bill }) {
  const theme = useTheme();
  const remaining = bill ? Math.max(bill.total - bill.paid, 0) : 0;
  const value = bill ? remaining : account.balance;
  const negative = bill ? bill.status === 'overdue' : account.balance < 0;

  return (
    <>
      <View style={styles.rowText}>
        <ThemedText numberOfLines={1}>{account.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {bill ? describeBill(bill) : ACCOUNT_TYPE_LABELS[account.type]}
        </ThemedText>
      </View>
      <ThemedText style={[styles.balance, negative && { color: theme.expense }]}>{formatMoney(value)}</ThemedText>
    </>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  totalCard: {
    gap: Spacing.one,
  },
  total: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  list: {
    paddingVertical: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: Spacing.two,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  balance: {
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
});
