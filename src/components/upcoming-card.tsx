import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDayLabel, today } from '@/lib/dates';
import { listCardBills, needsPayment, type CardBill } from '@/lib/card-bills';
import { formatMoney } from '@/lib/money';
import { listPendingConfirmations, listUpcoming, type Occurrence } from '@/lib/recurrences';

/** Quantos dias à frente o card mostra, e no máximo quantas linhas de "próximos". */
const UPCOMING_DAYS = 7;
const UPCOMING_LIMIT = 5;

// ─── Card ─────────────────────────────────────────────────────────────────────

/**
 * Card "Próximos" da Início: faturas de cartão fechadas a pagar, ocorrências que esperam
 * confirmação e as dos próximos 7 dias, nessa ordem. Some quando não há nada.
 */
export function UpcomingCard() {
  const theme = useTheme();
  const now = today();
  // Dados do banco: faturas, pendentes e próximos, numa consulta só.
  const { data } = useQuery(
    async (db) => ({
      bills: (await listCardBills(db, now)).filter(needsPayment),
      pending: await listPendingConfirmations(db),
      upcoming: await listUpcoming(db, UPCOMING_DAYS),
    }),
    `upcoming:${now}`
  );

  if (!data || (data.bills.length === 0 && data.pending.length === 0 && data.upcoming.length === 0)) return null;
  const upcoming = data.upcoming.slice(0, UPCOMING_LIMIT);

  return (
    <Card style={styles.card}>
      {/* Título e link para a tela Recorrentes */}
      <View style={styles.header}>
        <ThemedText type="smallBold">Próximos</ThemedText>
        <Pressable onPress={() => router.push('/recurrences')} hitSlop={8}>
          <ThemedText type="small" style={{ color: theme.tint }}>
            Recorrentes
          </ThemedText>
        </Pressable>
      </View>

      {/* Faturas fechadas a pagar */}
      {data.bills.length > 0 && (
        <>
          <ThemedText type="small" style={{ color: theme.warning }}>
            Faturas a pagar
          </ThemedText>
          <View>
            {data.bills.map((item, index) => (
              <Fragment key={item.card.id}>
                {index > 0 && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
                <BillRow item={item} />
              </Fragment>
            ))}
          </View>
        </>
      )}

      {/* Aguardando confirmação */}
      {data.pending.length > 0 && (
        <>
          <ThemedText type="small" style={{ color: theme.warning }}>
            Aguardando confirmação
          </ThemedText>
          <OccurrenceList items={data.pending} pending />
        </>
      )}

      {/* Próximos dias. O subtítulo só aparece se houver pendentes acima. */}
      {upcoming.length > 0 && (
        <>
          {data.pending.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Próximos {UPCOMING_DAYS} dias
            </ThemedText>
          )}
          <OccurrenceList items={upcoming} />
        </>
      )}
    </Card>
  );
}

// ─── Lista ────────────────────────────────────────────────────────────────────

/** Ocorrências separadas por linhas. */
function OccurrenceList({ items, pending }: { items: Occurrence[]; pending?: boolean }) {
  const theme = useTheme();
  return (
    <View>
      {items.map((item, index) => (
        <Fragment key={`${item.rec.id}:${item.nominal}`}>
          {index > 0 && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
          <OccurrenceRow item={item} pending={pending} />
        </Fragment>
      ))}
    </View>
  );
}

/**
 * Pendente: toca e abre o formulário em modo confirmação (com "Pular desta vez").
 * Futura: toca e abre a edição da recorrência.
 */
function OccurrenceRow({ item: { rec, nominal, date }, pending }: { item: Occurrence; pending?: boolean }) {
  const theme = useTheme();
  const isTransfer = rec.kind === 'transfer';
  const title = rec.description || (isTransfer ? 'Transferência' : (rec.category_name ?? 'Sem categoria'));
  const color = isTransfer ? theme.transfer : rec.kind === 'income' ? theme.income : theme.text;
  const sign = isTransfer ? '' : rec.kind === 'income' ? '+' : '−';

  const open = () =>
    router.push({
      pathname: '/transaction',
      params: pending ? { recurrenceId: String(rec.id), nominal } : { recurrenceId: String(rec.id) },
    });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={pending ? 'Abre para confirmar ou pular' : 'Abre a recorrência'}
      onPress={open}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <Badge
        size={32}
        icon={isTransfer ? 'bank' : rec.category_icon}
        color={isTransfer ? theme.transfer : rec.category_color}
      />
      <View style={styles.rowText}>
        <ThemedText type="small" numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {formatDayLabel(date, { short: true })}
        </ThemedText>
      </View>
      <ThemedText type="small" style={[styles.amount, { color }]}>
        {sign}
        {formatMoney(rec.amount)}
      </ThemedText>
    </Pressable>
  );
}

/** Fatura a pagar: cartão, vencimento (em vermelho se venceu) e quanto falta. Tocar abre o cartão. */
function BillRow({ item: { card, bill } }: { item: CardBill }) {
  const theme = useTheme();
  const overdue = bill.status === 'overdue';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/card', params: { id: String(card.id) } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <Badge size={32} icon={card.icon} color={card.color} />
      <View style={styles.rowText}>
        <ThemedText type="small" numberOfLines={1}>
          Fatura {card.name}
        </ThemedText>
        <ThemedText type="small" numberOfLines={1} style={{ color: overdue ? theme.expense : theme.textSecondary }}>
          {overdue ? 'Venceu' : 'Vence'} {formatDayLabel(bill.due, { short: true }).toLowerCase()}
        </ThemedText>
      </View>
      <ThemedText type="small" style={styles.amount}>
        {formatMoney(bill.total - bill.paid)}
      </ThemedText>
    </Pressable>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: Spacing.one,
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
    marginLeft: 42,
  },
});
