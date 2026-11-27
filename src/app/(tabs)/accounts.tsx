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
import { formatMoney } from '@/lib/money';

// ─── Tela ─────────────────────────────────────────────────────────────────────

/** Aba Contas: saldo de cada conta e o total. Tocar numa conta abre o formulário dela. */
export default function AccountsScreen() {
  const theme = useTheme();
  const date = today();

  // Dados do banco (inclui as arquivadas)
  const { data: accounts } = useQuery((db) => listAccounts(db, date, true), date);

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

      {active.length > 0 && <AccountGroup accounts={active} />}

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
function AccountGroup({ accounts }: { accounts: AccountWithBalance[] }) {
  const theme = useTheme();
  return (
    <Card style={styles.list}>
      {accounts.map((account, index) => (
        <Fragment key={account.id}>
          {index > 0 && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/account', params: { id: String(account.id) } })}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }, account.archived ? { opacity: 0.6 } : null]}>
            <Badge icon={account.icon} color={account.color} />
            <View style={styles.rowText}>
              <ThemedText numberOfLines={1}>{account.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {ACCOUNT_TYPE_LABELS[account.type]}
              </ThemedText>
            </View>
            <ThemedText style={[styles.balance, account.balance < 0 && { color: theme.expense }]}>
              {formatMoney(account.balance)}
            </ThemedText>
          </Pressable>
        </Fragment>
      ))}
    </Card>
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
