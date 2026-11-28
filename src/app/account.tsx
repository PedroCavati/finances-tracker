import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AmountInput, IconPicker, SwatchPicker } from '@/components/pickers';
import { FormScroll } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Field, HeaderButton, Segmented, TextField } from '@/components/ui';
import { ACCOUNT_ICON_KEYS } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import {
  countAccountTransactions,
  deleteAccount,
  getAccount,
  saveAccount,
  setAccountArchived,
} from '@/db/queries';
import { ACCOUNT_TYPE_LABELS, type Account, type AccountType } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { billMonthOf, dueDate } from '@/lib/credit-card';
import { formatShortDate, today } from '@/lib/dates';

/** Ícone sugerido para cada tipo ao criar uma conta (ao editar, trocar o tipo não muda o ícone). */
const DEFAULT_ICON: Record<AccountType, string> = {
  checking: 'bank',
  savings: 'piggy',
  cash: 'wallet',
  credit_card: 'card',
  investment: 'invest',
};

// ─── Tela ─────────────────────────────────────────────────────────────────────

/** Modal de conta. Sem `id`, cria; com `id`, edita, arquiva ou apaga. */
export default function AccountForm() {
  const db = useSQLiteContext();
  const theme = useTheme();

  // Parâmetros da rota
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : undefined;

  // Campos. `loaded`: undefined = carregando, null = conta nova, Account = a conta salva.
  // O saldo fica sempre positivo no campo; `negative` guarda o sinal.
  const [loaded, setLoaded] = useState<Account | null | undefined>(id ? undefined : null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [balance, setBalance] = useState(0);
  const [amountFocused, setAmountFocused] = useState(false);
  const [negative, setNegative] = useState(false);
  const [color, setColor] = useState('#0090FF');
  const [icon, setIcon] = useState('bank');
  const [saving, setSaving] = useState(false);

  // Cartão de crédito. Os dias ficam como texto enquanto são digitados.
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [creditLimit, setCreditLimit] = useState(0);

  // Preenche os campos ao editar.
  useEffect(() => {
    if (!id) return;
    getAccount(db, id).then((account) => {
      setLoaded(account);
      if (!account) return;
      setName(account.name);
      setType(account.type);
      setBalance(Math.abs(account.initial_balance));
      setNegative(account.initial_balance < 0);
      setColor(account.color);
      setIcon(account.icon);
      setClosingDay(account.closing_day ? String(account.closing_day) : '');
      setDueDay(account.due_day ? String(account.due_day) : '');
      setCreditLimit(account.credit_limit);
    });
  }, [db, id]);

  // Cartão: os dois dias são obrigatórios, de 1 a 31.
  const isCard = type === 'credit_card';
  const closing = parseDay(closingDay);
  const due = parseDay(dueDay);
  const cardOk = !isCard || (closing !== null && due !== null);

  // Validação
  const canSave = name.trim().length > 0 && cardOk && !saving;

  // ── Ações ──

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await saveAccount(
        db,
        {
          name: name.trim(),
          type,
          // No cartão, o saldo digitado é sempre dívida.
          initial_balance: isCard || negative ? -balance : balance,
          color,
          icon,
          closing_day: closing,
          due_day: due,
          credit_limit: creditLimit,
        },
        id
      );
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert('Não foi possível salvar', String(error));
    }
  }

  /** Avisa quantos lançamentos vão junto antes de apagar. */
  async function onDelete() {
    if (!id) return;
    const count = await countAccountTransactions(db, id);
    Alert.alert(
      'Apagar conta?',
      count > 0
        ? `Os ${count} lançamentos desta conta também serão apagados. Isso não pode ser desfeito. Se quiser só escondê-la, use "Arquivar".`
        : 'Isso não pode ser desfeito.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            await deleteAccount(db, id);
            router.back();
          },
        },
      ]
    );
  }

  async function onToggleArchive() {
    if (!id || !loaded) return;
    await setAccountArchived(db, id, !loaded.archived);
    router.back();
  }

  // ── Formulário ──

  // Enquanto carrega, só o cabeçalho.
  if (id && loaded === undefined) return <Stack.Screen options={{ title: 'Conta' }} />;

  return (
    <>
      <Stack.Screen
        options={{
          title: id ? 'Editar conta' : 'Nova conta',
          headerLeft: () => <HeaderButton title="Cancelar" onPress={() => router.back()} />,
        }}
      />
      <FormScroll keyboardAware={!amountFocused}>
        {/* Nome e tipo. Ao criar, o tipo também troca o ícone. */}
        <Field label="Nome">
          <TextField value={name} onChangeText={setName} placeholder="Ex.: Nubank, Itaú, Carteira" autoFocus={!id} />
        </Field>

        <Field label="Tipo">
          <View style={styles.wrap}>
            {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => (
              <Chip
                key={t}
                label={ACCOUNT_TYPE_LABELS[t]}
                selected={type === t}
                onPress={() => {
                  setType(t);
                  if (!id) setIcon(DEFAULT_ICON[t]);
                }}
              />
            ))}
          </View>
        </Field>

        {/* Fatura e limite (só cartão) */}
        {isCard && (
          <>
            <View style={styles.days}>
              <View style={styles.day}>
                <Field label="Fecha no dia">
                  <TextField
                    value={closingDay}
                    onChangeText={(text) => setClosingDay(text.replace(/\D/g, ''))}
                    placeholder="Ex.: 3"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </Field>
              </View>
              <View style={styles.day}>
                <Field label="Vence no dia">
                  <TextField
                    value={dueDay}
                    onChangeText={(text) => setDueDay(text.replace(/\D/g, ''))}
                    placeholder="Ex.: 3"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </Field>
              </View>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              {closing && due
                ? `Uma compra feita hoje entra na fatura que vence em ${formatShortDate(dueDate(billMonthOf(today(), closing), closing, due))}.`
                : 'Informe os dias de 1 a 31, como aparecem na fatura do banco.'}
            </ThemedText>
            <Field label="Limite">
              <AmountInput value={creditLimit} onChange={setCreditLimit} onFocusChange={setAmountFocused} />
            </Field>
          </>
        )}

        {/* Saldo: na criação é o saldo de hoje; na edição, o inicial (antes dos lançamentos).
          No cartão é sempre dívida: o que já está gasto e ainda não foi pago. */}
        {isCard ? (
          <Field label={id ? 'Dívida inicial' : 'Dívida atual no cartão'}>
            <AmountInput
              value={balance}
              onChange={setBalance}
              color={balance > 0 ? theme.expense : undefined}
              onFocusChange={setAmountFocused}
            />
          </Field>
        ) : (
          <Field label={id ? 'Saldo inicial' : 'Saldo atual'}>
            <Segmented
              value={negative ? 'neg' : 'pos'}
              onChange={(v) => setNegative(v === 'neg')}
              options={[
                { value: 'pos', label: 'Positivo' },
                { value: 'neg', label: 'Negativo / dívida', color: theme.expense },
              ]}
            />
            <AmountInput
              value={balance}
              onChange={setBalance}
              color={negative ? theme.expense : undefined}
              onFocusChange={setAmountFocused}
            />
          </Field>
        )}

        {/* Aparência */}
        <Field label="Cor">
          <SwatchPicker value={color} onChange={setColor} />
        </Field>

        <Field label="Ícone">
          <IconPicker icons={ACCOUNT_ICON_KEYS} value={icon} color={color} onChange={setIcon} />
        </Field>

        {/* Botões: salvar e, ao editar, ver lançamentos, arquivar e apagar */}
        <View style={styles.actions}>
          <Button title="Salvar" onPress={onSave} disabled={!canSave} />
          {id && (
            <>
              <Button
                title="Ver lançamentos"
                variant="secondary"
                onPress={() => {
                  router.back();
                  router.navigate({ pathname: '/transactions', params: { accountId: String(id) } });
                }}
              />
              <Button title={loaded?.archived ? 'Desarquivar' : 'Arquivar'} variant="secondary" onPress={onToggleArchive} />
              <Button title="Apagar conta" variant="danger" onPress={onDelete} />
            </>
          )}
        </View>
      </FormScroll>
    </>
  );
}

// ─── Auxiliares ───────────────────────────────────────────────────────────────

/** "3" → 3; vazio ou fora de 1–31 → null. */
function parseDay(text: string) {
  const day = Number(text);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
  },
  days: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  day: {
    flex: 1,
  },
  hint: {
    textAlign: 'center',
  },
});
