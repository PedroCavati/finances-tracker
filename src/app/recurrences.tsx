import { router, Stack } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, EmptyState, HeaderButton, SectionTitle } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { listRecurrences } from '@/db/queries';
import type { RecurrenceRow } from '@/db/types';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDayLabel } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { actualDate, describeSchedule } from '@/lib/recurrences';

// ─── Tela ─────────────────────────────────────────────────────────────────────

/** Lista de recorrências (ativas e pausadas). Tocar numa abre a edição; "+" cria uma nova. */
export default function RecurrencesScreen() {
  const theme = useTheme();

  // Dados do banco
  const { data: recurrences } = useQuery((db) => listRecurrences(db), 'recurrences');


  // Valores calculados
  const active = recurrences?.filter((r) => !r.paused) ?? [];
  const paused = recurrences?.filter((r) => r.paused) ?? [];

  // Ações. "Nova" abre o formulário com "Repetir: mensal" já marcado.
  const create = () => router.push({ pathname: '/transaction', params: { repeat: 'monthly' } });

  return (
    <>
      {/* Cabeçalho da pilha: título e botão "Nova" */}
      <Stack.Screen
        options={{
          title: 'Recorrentes',
          headerRight: () => <HeaderButton title="Nova" bold onPress={create} />,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        <View style={styles.inner}>
          {/* Ativas */}
          {recurrences && recurrences.length === 0 && (
            <EmptyState
              title="Nenhuma recorrência"
              message="Cadastre aluguel, salário e assinaturas uma vez, e o app lança sozinho todo mês."
              action={<Button title="Criar recorrência" onPress={create} />}
            />
          )}

          {active.length > 0 && <RecurrenceGroup items={active} />}

          {/* Pausadas */}
          {paused.length > 0 && (
            <>
              <SectionTitle>Pausadas</SectionTitle>
              <RecurrenceGroup items={paused} />
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}

// ─── Lista ────────────────────────────────────────────────────────────────────

/** Card com as recorrências de um grupo, separadas por linhas. */
function RecurrenceGroup({ items }: { items: RecurrenceRow[] }) {
  const theme = useTheme();
  return (
    <Card style={styles.list}>
      {items.map((rec, index) => (
        <Fragment key={rec.id}>
          {index > 0 && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
          <RecurrenceItem rec={rec} />
        </Fragment>
      ))}
    </Card>
  );
}

/**
 * Uma recorrência: ícone, título (descrição ou categoria), regra e conta, próxima data real
 * e valor. Pausadas ficam apagadas. Tocar abre o formulário em modo "editar recorrência".
 */
function RecurrenceItem({ rec }: { rec: RecurrenceRow }) {
  const theme = useTheme();
  const isTransfer = rec.kind === 'transfer';
  const title =
    rec.description || (isTransfer ? 'Transferência' : (rec.category_name ?? 'Sem categoria'));
  const color = isTransfer ? theme.transfer : rec.kind === 'income' ? theme.income : theme.text;
  const sign = isTransfer ? '' : rec.kind === 'income' ? '+' : '−';
  const account = isTransfer ? `${rec.account_name} → ${rec.to_account_name}` : rec.account_name;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/transaction', params: { recurrenceId: String(rec.id) } })}
      style={({ pressed }) => [styles.row, (pressed || rec.paused === 1) && { opacity: 0.6 }]}>
      <Badge
        icon={isTransfer ? 'bank' : rec.category_icon}
        color={isTransfer ? theme.transfer : rec.category_color}
      />
      <View style={styles.rowText}>
        <ThemedText numberOfLines={1}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {describeSchedule(rec)} · {account}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {rec.paused
            ? 'Pausada'
            : `Próxima: ${formatDayLabel(actualDate(rec, rec.next_date), { short: true })}`}
          {rec.auto ? '' : ' · pede confirmação'}
          {rec.notify ? ' · com lembrete' : ''}
        </ThemedText>
      </View>
      <ThemedText style={[styles.amount, { color }]}>
        {sign}
        {formatMoney(rec.amount)}
      </ThemedText>
    </Pressable>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
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
  amount: {
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
});
