import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BudgetBar } from '@/components/budget-bar';
import { MonthSwitcher } from '@/components/month-switcher';
import { ThemedText } from '@/components/themed-text';
import { TransactionList } from '@/components/transaction-list';
import { Button, Card, EmptyState, HeaderButton, SectionTitle } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getAccount, listCardMovements, listTransactions } from '@/db/queries';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import {
  defaultBillMonth,
  shiftMonth,
  summarizeBills,
  usedLimit,
  type Bill,
  type BillStatus,
} from '@/lib/credit-card';
import { formatMonthShort, formatShortDate, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

/** Quantas faturas seguintes aparecem em "Próximas faturas". */
const UPCOMING_BILLS = 3;

/** Nome de cada situação da fatura. */
const STATUS_LABELS: Record<BillStatus, string> = {
  future: 'Futura',
  open: 'Aberta',
  closed: 'Fechada',
  partial: 'Paga em parte',
  overdue: 'Vencida',
  paid: 'Paga',
};

// ─── Tela ──────────────────────────────────────────────────────────────────

/**
 * Tela do cartão de crédito: limite disponível, a fatura escolhida (com fechamento,
 * vencimento, situação e "Pagar fatura"), as próximas faturas e os lançamentos da fatura.
 * Abre na última fatura fechada se ainda falta pagá-la; senão, na aberta.
 */
export default function CardScreen() {
  const theme = useTheme();
  const now = today();

  // Parâmetros da rota
  const params = useLocalSearchParams<{ id: string }>();
  const cardId = Number(params.id);

  // Fatura escolhida nas setas ("2026-12"); null = a fatura padrão.
  const [month, setMonth] = useState<string | null>(null);

  // Dados do banco: o cartão, a fatura escolhida, as próximas e os lançamentos dela.
  const { data } = useQuery(async (db) => {
    const card = await getAccount(db, cardId);
    if (!card?.closing_day || !card.due_day) return { card, billing: null };

    const billingCard = { ...card, closing_day: card.closing_day, due_day: card.due_day };
    const movements = await listCardMovements(db, cardId);
    const shown = month ?? defaultBillMonth(billingCard, movements, now);
    const [bill] = summarizeBills(billingCard, movements, [shown], now);
    const nextMonths = Array.from({ length: UPCOMING_BILLS }, (_, i) => shiftMonth(shown, i + 1));
    const upcoming = summarizeBills(billingCard, movements, nextMonths, now).filter((b) => b.total > 0);

    // Lançamentos do período da fatura, sem os pagamentos (que quitam a fatura anterior).
    const items = (await listTransactions(db, { accountId: cardId, start: bill.start, end: bill.end, limit: 500 }))
      .filter((t) => !(t.kind === 'transfer' && t.to_account_id === cardId));

    return { card, billing: { bill, upcoming, items, used: usedLimit(billingCard, movements, now) } };
  }, `card:${cardId}:${month}:${now}`);

  const card = data?.card;
  const billing = data?.billing;

  // Ações
  const edit = () => router.push({ pathname: '/account', params: { id: String(cardId) } });

  return (
    <>
      {/* Cabeçalho da pilha: nome do cartão e "Editar" */}
      <Stack.Screen
        options={{
          title: card?.name ?? 'Cartão',
          headerRight: () => <HeaderButton title="Editar" onPress={edit} />,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        <View style={styles.inner}>
          {/* Cartão sem fechamento e vencimento: não há como montar faturas */}
          {data && !billing && (
            <EmptyState
              title="Faltam os dias da fatura"
              message="Informe o dia de fechamento e o de vencimento para ver as faturas deste cartão."
              action={<Button title="Editar cartão" onPress={edit} />}
            />
          )}

          {card && billing && (
            <>
              {/* Limite (só se foi informado) */}
              {card.credit_limit > 0 && (
                <Card style={styles.limitCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Limite disponível
                  </ThemedText>
                  <ThemedText style={styles.big}>{formatMoney(card.credit_limit - billing.used)}</ThemedText>
                  <BudgetBar spent={billing.used} budget={card.credit_limit} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatMoney(billing.used)} usados de {formatMoney(card.credit_limit)}
                  </ThemedText>
                </Card>
              )}

              {/* Fatura escolhida */}
              <BillCard
                bill={billing.bill}
                onMove={(delta) => setMonth(shiftMonth(billing.bill.month, delta))}
                onReset={() => setMonth(null)}
                onPay={(remaining) =>
                  router.push({
                    pathname: '/transaction',
                    params: {
                      kind: 'transfer',
                      toAccountId: String(cardId),
                      amount: String(remaining),
                      description: `Fatura ${card.name} ${formatMonthShort(`${billing.bill.month}-01`)}`,
                    },
                  })
                }
              />

              {/* Próximas faturas (parcelas já lançadas) */}
              {billing.upcoming.length > 0 && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.upcoming}>
                  Próximas:{' '}
                  {billing.upcoming
                    .map((b) => `${formatMonthShort(`${b.month}-01`)} ${formatMoney(b.total)}`)
                    .join(' · ')}
                </ThemedText>
              )}

              {/* Lançamentos da fatura */}
              <SectionTitle>Lançamentos da fatura</SectionTitle>
              {billing.items.length === 0 ? (
                <EmptyState title="Nenhum lançamento nesta fatura" />
              ) : (
                <TransactionList items={billing.items} accountId={cardId} />
              )}
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}

// ─── Fatura ────────────────────────────────────────────────────────────────

/**
 * Resumo de uma fatura: seletor de mês, total, situação, fechamento, vencimento, quanto
 * já foi pago e o botão "Pagar fatura" (com o valor que falta) enquanto houver o que pagar.
 */
function BillCard({
  bill,
  onMove,
  onReset,
  onPay,
}: {
  bill: Bill;
  onMove: (delta: -1 | 1) => void;
  onReset: () => void;
  onPay: (remaining: number) => void;
}) {
  const theme = useTheme();
  const remaining = Math.max(bill.total - bill.paid, 0);
  const statusColor = {
    future: theme.textSecondary,
    open: theme.tint,
    closed: theme.warning,
    partial: theme.warning,
    overdue: theme.expense,
    paid: theme.income,
  }[bill.status];
  const canPay = remaining > 0 && bill.status !== 'future';

  return (
    <Card style={styles.billCard}>
      <MonthSwitcher monthStart={`${bill.month}-01`} onMove={onMove} onReset={onReset} />

      {/* Total e situação */}
      <View style={styles.billHeader}>
        <ThemedText style={styles.big}>{formatMoney(bill.total)}</ThemedText>
        <ThemedText type="smallBold" style={{ color: statusColor }}>
          {STATUS_LABELS[bill.status]}
        </ThemedText>
      </View>

      {/* Datas e pagamento */}
      <ThemedText type="small" themeColor="textSecondary">
        Fecha {formatShortDate(bill.closing)} · Vence {formatShortDate(bill.due)}
      </ThemedText>
      {bill.paid > 0 && remaining > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Pago {formatMoney(bill.paid)} · falta {formatMoney(remaining)}
        </ThemedText>
      )}

      {canPay && <Button title={`Pagar ${formatMoney(remaining)}`} onPress={() => onPay(remaining)} />}
    </Card>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────

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
  big: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },

  // Limite
  limitCard: {
    gap: Spacing.two,
  },

  // Fatura
  billCard: {
    gap: Spacing.two,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  upcoming: {
    paddingHorizontal: Spacing.one,
  },
});
