import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { distributeInstallments } from '@/lib/credit-card';
import { formatMonthShort } from '@/lib/dates';
import { centsToInput, formatMoney, parseMoneyInput } from '@/lib/money';

/**
 * Lista das parcelas de uma compra nova: número, mês e valor. Tocar numa parcela permite
 * digitar o valor dela à mão (fica em negrito); as outras dividem o que sobra do total.
 * Se a conta não fechar, mostra a diferença e um atalho para desfazer os valores digitados.
 */
export function InstallmentList({
  total,
  dates,
  fixed,
  onChangeFixed,
}: {
  /** Valor total da compra, em centavos. */
  total: number;
  /** Data de cada parcela (o tamanho define quantas são). */
  dates: string[];
  /** Valor digitado de cada parcela, ou null se é calculado. */
  fixed: (number | null)[];
  onChangeFixed: (fixed: (number | null)[]) => void;
}) {
  const theme = useTheme();
  const result = distributeInstallments(total, fixed);
  const count = dates.length;

  // Troca o valor de uma parcela; null volta para o cálculo automático.
  const setParcel = (index: number, value: number | null) =>
    onChangeFixed(fixed.map((current, i) => (i === index ? value : current)));

  // Caixa de texto nativa do iOS para digitar o valor de uma parcela.
  const edit = (index: number, current: number) =>
    Alert.prompt(
      `Parcela ${index + 1} de ${count}`,
      'Digite o valor desta parcela. As que você não editou se ajustam para fechar o total.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Automático', onPress: () => setParcel(index, null) },
        {
          text: 'OK',
          isPreferred: true,
          onPress: (text?: string) => {
            const value = parseMoneyInput(text ?? '');
            if (value !== null && value > 0) setParcel(index, value);
          },
        },
      ],
      'plain-text',
      centsToInput(current),
      'decimal-pad'
    );

  return (
    <View style={[styles.list, { borderColor: theme.border }]}>
      {/* Uma linha por parcela */}
      {dates.map((date, i) => {
        const isFixed = fixed[i] !== null;
        const value = result.ok ? result.amounts[i] : fixed[i];
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Parcela ${i + 1} de ${count}, ${value === null ? 'a calcular' : formatMoney(value)}. Toque para editar.`}
            onPress={() => edit(i, value ?? 0)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.number}>
              {i + 1}/{count}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.month}>
              {formatMonthShort(date)}
            </ThemedText>
            <ThemedText type={isFixed ? 'smallBold' : 'small'} style={styles.amount}>
              {value === null ? '—' : formatMoney(value)}
            </ThemedText>
          </Pressable>
        );
      })}

      {/* Rodapé: dica, ou a diferença quando a conta não fecha */}
      {result.ok ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
          Toque numa parcela para mudar o valor.
        </ThemedText>
      ) : (
        <View style={styles.footer}>
          <ThemedText type="small" style={{ color: theme.expense }}>
            {result.difference > 0
              ? `Faltam ${formatMoney(result.difference)} para chegar ao total.`
              : `As parcelas passam do total em ${formatMoney(-result.difference)}.`}
          </ThemedText>
          <Pressable onPress={() => onChangeFixed(fixed.map(() => null))} hitSlop={8}>
            <ThemedText type="small" style={{ color: theme.tint }}>
              Desfazer valores editados
            </ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  number: {
    width: 44,
    fontVariant: ['tabular-nums'],
  },
  month: {
    flex: 1,
  },
  amount: {
    fontVariant: ['tabular-nums'],
  },
  footer: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
});