import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AmountInput, DateField } from '@/components/pickers';
import { FormScroll } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, EmptyState, Field, HeaderButton, Segmented, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import {
  deleteRecurrence,
  deleteTransaction,
  getRecurrence,
  getTransaction,
  listAccounts,
  listCategories,
  saveRecurrence,
  saveTransaction,
} from '@/db/queries';
import { ensureNotificationPermission } from '@/lib/notifications';
import {
  BUSINESS_DAY_LABELS,
  FREQUENCY_LABELS,
  type BusinessDayRule,
  type Frequency,
  type Recurrence,
  type TransactionKind,
} from '@/db/types';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { checkBudgetAlert } from '@/lib/budget-alerts';
import { addMonthsClamped, formatShortDate, today } from '@/lib/dates';
import { nthBusinessDay } from '@/lib/holidays';
import {
  actualDate,
  confirmOccurrence,
  describeSchedule,
  runDueRecurrences,
  setPaused,
  skipOccurrence,
} from '@/lib/recurrences';

/** Tipo no título do modal: "Nova despesa", "Editar receita"... */
const KIND_TITLES: Record<TransactionKind, string> = {
  expense: 'despesa',
  income: 'receita',
  transfer: 'transferência',
};

/** O que o formulário está fazendo, conforme os parâmetros recebidos. */
type Mode = 'create' | 'edit' | 'editRecurrence' | 'confirm';

// ─── Tela ─────────────────────────────────────────────────────────────────────

/**
 * Modal de lançamento, em quatro modos:
 * - sem parâmetros: cria um lançamento (o `kind` opcional escolhe o tipo), que pode repetir;
 * - `id`: edita ou apaga um lançamento;
 * - `recurrenceId`: edita, pausa ou apaga uma recorrência;
 * - `recurrenceId` + `nominal`: confirma (ou pula) uma ocorrência pendente, com os dados já preenchidos.
 */
export default function TransactionForm() {
  const db = useSQLiteContext();
  const theme = useTheme();

  // Parâmetros da rota e modo
  const params = useLocalSearchParams<{
    id?: string;
    kind?: TransactionKind;
    recurrenceId?: string;
    nominal?: string;
    repeat?: Frequency;
  }>();
  const id = params.id ? Number(params.id) : undefined;
  const recurrenceId = params.recurrenceId ? Number(params.recurrenceId) : undefined;
  const mode: Mode = id ? 'edit' : recurrenceId ? (params.nominal ? 'confirm' : 'editRecurrence') : 'create';

  // Campos do lançamento. `loaded` fica falso até os dados de edição chegarem do banco.
  const [loaded, setLoaded] = useState(mode === 'create');
  const [kind, setKind] = useState<TransactionKind>(params.kind ?? 'expense');
  const [amount, setAmount] = useState(0);
  const [amountFocused, setAmountFocused] = useState(false);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(today());
  const [accountId, setAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Campos da repetição. `repeat` null = lançamento único; `recurrence` é a regra salva (editar/confirmar).
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [repeat, setRepeat] = useState<Frequency | null>(params.repeat ?? null);
  const [auto, setAuto] = useState(true);
  const [notify, setNotify] = useState(false);
  const [businessDays, setBusinessDays] = useState<BusinessDayRule>('none');
  const [businessDayN, setBusinessDayN] = useState<number | null>(null);

  // Dados do banco
  const now = today();
  const { data: accounts } = useQuery((d) => listAccounts(d, now, true), now);
  const { data: categories } = useQuery((d) => listCategories(d), 'all');

  // Preenche os campos ao editar um lançamento ou abrir uma recorrência.
  useEffect(() => {
    if (id) {
      getTransaction(db, id).then((t) => {
        if (t) {
          setKind(t.kind);
          setAmount(t.amount);
          setDescription(t.description);
          setNotes(t.notes);
          setDate(t.date);
          setAccountId(t.account_id);
          setToAccountId(t.to_account_id);
          setCategoryId(t.category_id);
        }
        setLoaded(true);
      });
    } else if (recurrenceId) {
      getRecurrence(db, recurrenceId).then((rec) => {
        if (rec) {
          setRecurrence(rec);
          setKind(rec.kind);
          setAmount(rec.amount);
          setDescription(rec.description);
          setNotes(rec.notes);
          setAccountId(rec.account_id);
          setToAccountId(rec.to_account_id);
          setCategoryId(rec.category_id);
          setRepeat(rec.frequency);
          setAuto(rec.auto === 1);
          setNotify(rec.notify === 1);
          setBusinessDays(rec.business_days);
          setBusinessDayN(rec.business_day_n);
          // Confirmar: a data da ocorrência. Editar: a próxima data da regra.
          setDate(params.nominal ? actualDate(rec, params.nominal) : rec.next_date);
        }
        setLoaded(true);
      });
    }
  }, [db, id, recurrenceId, params.nominal]);

  // ── Valores calculados ──

  // Contas arquivadas só aparecem se já estiverem neste lançamento.
  const visibleAccounts = (accounts ?? []).filter(
    (a) => !a.archived || a.id === accountId || a.id === toAccountId
  );

  // Conta padrão num lançamento novo: a primeira conta ativa.
  const firstActive = accounts?.find((a) => !a.archived)?.id ?? null;
  const effectiveAccountId = accountId ?? (mode === 'create' ? firstActive : null);

  // Categorias do tipo atual. Escolher uma subcategoria mantém a principal destacada.
  const kindCategories = (categories ?? []).filter((c) => c.kind === kind);
  const parents = kindCategories.filter((c) => c.parent_id === null);
  const selected = kindCategories.find((c) => c.id === categoryId);
  const selectedParentId = selected ? (selected.parent_id ?? selected.id) : null;
  const subcategories = kindCategories.filter((c) => c.parent_id !== null && c.parent_id === selectedParentId);
  const selectedParent = parents.find((c) => c.id === selectedParentId);

  // Validação: valor, conta, e numa transferência uma conta de destino diferente da de origem.
  const isTransfer = kind === 'transfer';
  const validTransfer = !isTransfer || (toAccountId !== null && toAccountId !== effectiveAccountId);
  const canSave = amount > 0 && effectiveAccountId !== null && validTransfer && !saving;

  // Repetição: só aparece ao criar ou editar uma recorrência (não ao editar um lançamento único).
  const showRepeat = mode === 'create' || mode === 'editRecurrence';
  const isRecurring = showRepeat && repeat !== null;
  const usesBusinessDayN = repeat === 'monthly' && businessDayN !== null;

  // Regra que vai ser salva, com a primeira data nominal já normalizada.
  const schedule = isRecurring
    ? {
      frequency: repeat,
      business_days: usesBusinessDayN ? ('none' as const) : businessDays,
      business_day_n: usesBusinessDayN ? businessDayN : null,
      anchor_date: firstNominal(date, usesBusinessDayN ? businessDayN : null),
    }
    : null;

  // ── Ações ──

  function changeKind(next: TransactionKind) {
    setKind(next);
    // A categoria de despesa não vale para receita e vice-versa.
    setCategoryId(null);
  }

  /** Salva conforme o modo: confirma a ocorrência, salva a regra ou salva o lançamento. */
  async function onSave() {
    if (!canSave || effectiveAccountId === null) return;
    setSaving(true);
    const transaction = {
      kind,
      amount,
      date,
      description,
      notes,
      account_id: effectiveAccountId,
      to_account_id: toAccountId,
      category_id: categoryId,
    };
    try {
      if (mode === 'confirm' && recurrence && params.nominal) {
        await confirmOccurrence(db, recurrence, params.nominal, transaction);
      } else if (schedule) {
        // Só muda o ponto de partida se a regra ou a data mudaram. Assim, editar só o
        // valor não faz um mensal do dia 31 "esquecer" o 31 depois de um fevereiro.
        const sameSchedule =
          recurrence !== null &&
          recurrence.frequency === schedule.frequency &&
          recurrence.business_days === schedule.business_days &&
          recurrence.business_day_n === schedule.business_day_n &&
          recurrence.next_date === date;
        const anchor = sameSchedule ? recurrence.anchor_date : schedule.anchor_date;

        // O lembrete precisa de permissão. Pede antes de salvar: o reagendamento roda logo depois de gravar e precisa encontrar a permissão já dada.
        if (notify) await ensureNotificationPermission();

        await saveRecurrence(
          db,
          {
            ...transaction,
            ...schedule,
            anchor_date: anchor,
            next_date: sameSchedule ? recurrence.next_date : anchor,
            auto: auto ? 1 : 0,
            paused: recurrence?.paused ?? 0,
            notify: notify ? 1 : 0,
          },
          recurrenceId
        );
        // Gera na hora o que já venceu (ex.: uma recorrência criada com a data de hoje).
        await runDueRecurrences(db);
      } else {
        await saveTransaction(db, transaction, id);
      }
      if (kind === 'expense' && !schedule) {
        // Sem await: o modal fecha na hora e o aviso chega logo depois.
        checkBudgetAlert(db, categoryId, date).catch(() => { });
      }
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert('Não foi possível salvar', String(error));
    }
  }

  /** Pergunta antes de apagar o lançamento ou a recorrência. */
  function onDelete() {
    if (mode === 'editRecurrence' && recurrenceId) {
      Alert.alert(
        'Apagar recorrência?',
        'Os lançamentos já criados continuam no histórico. Isso não pode ser desfeito.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Apagar',
            style: 'destructive',
            onPress: async () => {
              await deleteRecurrence(db, recurrenceId);
              router.back();
            },
          },
        ]
      );
      return;
    }
    if (!id) return;
    Alert.alert('Apagar lançamento?', 'Isso não pode ser desfeito.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(db, id);
          router.back();
        },
      },
    ]);
  }

  async function onTogglePause() {
    if (!recurrence) return;
    await setPaused(db, recurrence, !recurrence.paused);
    router.back();
  }

  async function onSkip() {
    if (!recurrence || !params.nominal) return;
    await skipOccurrence(db, recurrence, params.nominal);
    router.back();
  }

  // ── Cabeçalho ──

  const title =
    mode === 'editRecurrence'
      ? 'Editar recorrência'
      : mode === 'confirm'
        ? `Confirmar ${KIND_TITLES[kind]}`
        : `${mode === 'edit' ? 'Editar' : 'Nova'} ${KIND_TITLES[kind]}`;

  const header = (
    <Stack.Screen
      options={{
        title,
        headerLeft: () => <HeaderButton title="Cancelar" onPress={() => router.back()} />,
        headerRight: () =>
          canSave ? <HeaderButton title={mode === 'confirm' ? 'Confirmar' : 'Salvar'} bold onPress={onSave} /> : null,
      }}
    />
  );

  // Enquanto carrega, só o cabeçalho. Sem contas, não há onde lançar.
  if (!loaded || !accounts || !categories) return header;

  if (accounts.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          title="Crie uma conta primeiro"
          message="Todo lançamento pertence a uma conta, como sua conta corrente ou a carteira."
          action={
            <Button
              title="Criar conta"
              onPress={() => {
                router.back();
                router.push('/account');
              }}
            />
          }
        />
      </>
    );
  }

  // ── Formulário ──

  const amountColor = kind === 'income' ? theme.income : kind === 'expense' ? theme.expense : theme.transfer;
  const dateLabel = usesBusinessDayN
    ? 'A partir de'
    : mode === 'editRecurrence'
      ? 'Próxima data'
      : isRecurring
        ? 'Primeira data'
        : 'Data';

  return (
    <>
      {header}
      <FormScroll keyboardAware={!amountFocused}>
        {/* Tipo e valor */}
        <Segmented
          value={kind}
          onChange={changeKind}
          options={[
            { value: 'expense', label: 'Despesa', color: theme.expense },
            { value: 'income', label: 'Receita', color: theme.income },
            { value: 'transfer', label: 'Transferência', color: theme.transfer },
          ]}
        />

        <AmountInput
          value={amount}
          onChange={setAmount}
          color={amountColor}
          autoFocus={mode === 'create'}
          onFocusChange={setAmountFocused}
        />

        {/* Descrição */}
        <Field label="Descrição">
          <TextField
            value={description}
            onChangeText={setDescription}
            placeholder={isTransfer ? 'Ex.: Reserva do mês' : 'Ex.: Almoço, Uber, Netflix'}
            returnKeyType="done"
          />
        </Field>

        {/* Categoria e subcategoria. Tocar de novo na principal selecionada desmarca. */}
        {!isTransfer && (
          <Field label="Categoria">
            <View style={styles.wrap}>
              {parents.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  icon={c.icon}
                  color={c.color}
                  selected={selectedParentId === c.id}
                  onPress={() => setCategoryId(selectedParentId === c.id && categoryId === c.id ? null : c.id)}
                />
              ))}
            </View>
          </Field>
        )}

        {!isTransfer && selectedParent && subcategories.length > 0 && (
          <Field label={`Subcategoria de ${selectedParent.name}`}>
            <View style={styles.wrap}>
              <Chip
                label="Nenhuma"
                selected={categoryId === selectedParent.id}
                onPress={() => setCategoryId(selectedParent.id)}
              />
              {subcategories.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  icon={c.icon}
                  color={c.color}
                  selected={categoryId === c.id}
                  onPress={() => setCategoryId(c.id)}
                />
              ))}
            </View>
          </Field>
        )}

        {/* Conta (ou "De" e "Para" numa transferência) */}
        <Field label={isTransfer ? 'De' : 'Conta'}>
          <View style={styles.wrap}>
            {visibleAccounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                icon={a.icon}
                color={a.color}
                selected={effectiveAccountId === a.id}
                onPress={() => setAccountId(a.id)}
              />
            ))}
          </View>
        </Field>

        {isTransfer && (
          <Field label="Para">
            <View style={styles.wrap}>
              {visibleAccounts
                .filter((a) => a.id !== effectiveAccountId)
                .map((a) => (
                  <Chip
                    key={a.id}
                    label={a.name}
                    icon={a.icon}
                    color={a.color}
                    selected={toAccountId === a.id}
                    onPress={() => setToAccountId(a.id)}
                  />
                ))}
            </View>
            {visibleAccounts.length < 2 && (
              <ThemedText type="small" themeColor="textSecondary">
                Você precisa de pelo menos duas contas para transferir.
              </ThemedText>
            )}
          </Field>
        )}

        {/* Data */}
        <Field label={dateLabel}>
          <DateField value={date} onChange={setDate} />
        </Field>

        {/* Repetição: frequência, dia do mês, ajuste de dia útil e modo de lançar */}
        {showRepeat && (
          <Field label="Repetir">
            <View style={styles.wrap}>
              {mode === 'create' && (
                <Chip label="Não repetir" selected={repeat === null} onPress={() => setRepeat(null)} />
              )}
              {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
                <Chip key={f} label={FREQUENCY_LABELS[f]} selected={repeat === f} onPress={() => setRepeat(f)} />
              ))}
            </View>
          </Field>
        )}

        {isRecurring && schedule && (
          <>
            {repeat === 'monthly' && (
              <Field label="Dia do mês">
                <Segmented
                  value={usesBusinessDayN ? 'nth' : 'date'}
                  onChange={(v) => setBusinessDayN(v === 'nth' ? 5 : null)}
                  options={[
                    { value: 'date', label: 'Mesmo dia da data' },
                    { value: 'nth', label: 'Nº dia útil' },
                  ]}
                />
                {usesBusinessDayN && (
                  <Stepper
                    label={`${businessDayN}º dia útil`}
                    onDecrease={() => setBusinessDayN((n) => Math.max(1, (n ?? 1) - 1))}
                    onIncrease={() => setBusinessDayN((n) => Math.min(23, (n ?? 1) + 1))}
                  />
                )}
              </Field>
            )}

            {!usesBusinessDayN && (
              <Field label="Se cair em fim de semana ou feriado">
                <Segmented
                  value={businessDays}
                  onChange={setBusinessDays}
                  options={(Object.keys(BUSINESS_DAY_LABELS) as BusinessDayRule[]).map((rule) => ({
                    value: rule,
                    label: rule === 'none' ? 'Manter' : rule === 'next' ? 'Dia seguinte' : 'Dia anterior',
                  }))}
                />
              </Field>
            )}

            <Field label="Lembrete">
              <Segmented
                value={notify ? 'on' : 'off'}
                onChange={(v) => setNotify(v === 'on')}
                options={[
                  { value: 'off', label: 'Não avisar' },
                  { value: 'on', label: 'Avisar no dia, 9h' },
                ]}
              />
            </Field>

            <Field label="Ao chegar a data">
              <Segmented
                value={auto ? 'auto' : 'confirm'}
                onChange={(v) => setAuto(v === 'auto')}
                options={[
                  { value: 'auto', label: 'Lançar sozinho' },
                  { value: 'confirm', label: 'Pedir confirmação' },
                ]}
              />
            </Field>

            {/* Resumo da regra, ex.: "Todo dia 10. Próxima: 10/12/2026." */}
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              {describeSchedule(schedule)}. Próxima: {formatShortDate(actualDate(schedule, schedule.anchor_date))}.
            </ThemedText>
          </>
        )}

        {/* Observação */}
        <Field label="Observação">
          <TextField
            value={notes}
            onChangeText={setNotes}
            placeholder="Opcional"
            multiline
            style={styles.notes}
          />
        </Field>

        {/* Botões do modo: salvar/confirmar, pular, pausar e apagar */}
        <View style={styles.actions}>
          <Button title={mode === 'confirm' ? 'Confirmar' : 'Salvar'} onPress={onSave} disabled={!canSave} />
          {mode === 'confirm' && <Button title="Pular desta vez" variant="secondary" onPress={onSkip} />}
          {mode === 'editRecurrence' && recurrence && (
            <Button title={recurrence.paused ? 'Retomar' : 'Pausar'} variant="secondary" onPress={onTogglePause} />
          )}
          {(mode === 'edit' || mode === 'editRecurrence') && (
            <Button
              title={mode === 'edit' ? 'Apagar lançamento' : 'Apagar recorrência'}
              variant="danger"
              onPress={onDelete}
            />
          )}
        </View>
      </FormScroll>
    </>
  );
}

// ─── Auxiliares ───────────────────────────────────────────────────────────────

/**
 * Primeira data nominal da regra. No "Nº dia útil" é o dia 1 do mês da data escolhida,
 * ou do mês seguinte se o N-ésimo dia útil daquele mês já passou da data.
 */
function firstNominal(date: string, businessDayN: number | null) {
  if (!businessDayN) return date;
  const monthStart = `${date.slice(0, 7)}-01`;
  return nthBusinessDay(monthStart, businessDayN) < date ? addMonthsClamped(monthStart, 1) : monthStart;
}

/** Botões − e + em volta de um rótulo, ex.: "−  5º dia útil  +". */
function Stepper({
  label,
  onDecrease,
  onIncrease,
}: {
  label: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Diminuir"
        onPress={onDecrease}
        style={[styles.stepperButton, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">−</ThemedText>
      </Pressable>
      <ThemedText type="smallBold" style={styles.stepperLabel}>
        {label}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aumentar"
        onPress={onIncrease}
        style={[styles.stepperButton, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">+</ThemedText>
      </Pressable>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  notes: {
    minHeight: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  hint: {
    textAlign: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLabel: {
    minWidth: 110,
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.two,
  },
});
