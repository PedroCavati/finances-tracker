import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AmountInput, DateField } from '@/components/pickers';
import { FormScroll } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, EmptyState, Field, HeaderButton, Segmented, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { deleteTransaction, getTransaction, listAccounts, listCategories, saveTransaction } from '@/db/queries';
import type { TransactionKind } from '@/db/types';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { today } from '@/lib/dates';
import { checkBudgetAlert } from '@/lib/budget-alerts';

const KIND_TITLES: Record<TransactionKind, string> = {
  expense: 'despesa',
  income: 'receita',
  transfer: 'transferência',
};

export default function TransactionForm() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string; kind?: TransactionKind }>();
  const id = params.id ? Number(params.id) : undefined;

  const [loaded, setLoaded] = useState(!id);
  const [kind, setKind] = useState<TransactionKind>(params.kind ?? 'expense');
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(today());
  const [accountId, setAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const now = today();
  const { data: accounts } = useQuery((d) => listAccounts(d, now, true), now);
  const { data: categories } = useQuery((d) => listCategories(d), 'all');

  useEffect(() => {
    if (!id) return;
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
  }, [db, id]);

  // Contas arquivadas só aparecem se já estiverem neste lançamento.
  const visibleAccounts = (accounts ?? []).filter(
    (a) => !a.archived || a.id === accountId || a.id === toAccountId
  );

  // Conta padrão num lançamento novo: a primeira conta ativa.
  const firstActive = accounts?.find((a) => !a.archived)?.id ?? null;
  const effectiveAccountId = accountId ?? (id ? null : firstActive);

  const kindCategories = (categories ?? []).filter((c) => c.kind === kind);
  const parents = kindCategories.filter((c) => c.parent_id === null);
  const selected = kindCategories.find((c) => c.id === categoryId);
  const selectedParentId = selected ? (selected.parent_id ?? selected.id) : null;
  const subcategories = kindCategories.filter((c) => c.parent_id !== null && c.parent_id === selectedParentId);

  const isTransfer = kind === 'transfer';
  const validTransfer = !isTransfer || (toAccountId !== null && toAccountId !== effectiveAccountId);
  const canSave = amount > 0 && effectiveAccountId !== null && validTransfer && !saving;

  function changeKind(next: TransactionKind) {
    setKind(next);
    // A categoria de despesa não vale para receita e vice-versa.
    setCategoryId(null);
  }

  async function onSave() {
    if (!canSave || effectiveAccountId === null) return;
    setSaving(true);
    try {
      await saveTransaction(
        db,
        {
          kind,
          amount,
          date,
          description,
          notes,
          account_id: effectiveAccountId,
          to_account_id: toAccountId,
          category_id: categoryId,
        },
        id
      );
      if (kind === 'expense') {
        // Sem await: o modal fecha na hora e o aviso chega logo depois.
        checkBudgetAlert(db, categoryId, date).catch(() => { });
      }
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert('Não foi possível salvar', String(error));
    }
  }

  function onDelete() {
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

  const header = (
    <Stack.Screen
      options={{
        title: id ? `Editar ${KIND_TITLES[kind]}` : `Nova ${KIND_TITLES[kind]}`,
        headerLeft: () => <HeaderButton title="Cancelar" onPress={() => router.back()} />,
        headerRight: () => (canSave ? <HeaderButton title="Salvar" bold onPress={onSave} /> : null),
      }}
    />
  );

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

  const amountColor = kind === 'income' ? theme.income : kind === 'expense' ? theme.expense : theme.transfer;

  return (
    <>
      {header}
      <FormScroll>
        <Segmented
          value={kind}
          onChange={changeKind}
          options={[
            { value: 'expense', label: 'Despesa', color: theme.expense },
            { value: 'income', label: 'Receita', color: theme.income },
            { value: 'transfer', label: 'Transferência', color: theme.transfer },
          ]}
        />

        <AmountInput value={amount} onChange={setAmount} color={amountColor} autoFocus={!id} />

        <Field label="Descrição">
          <TextField
            value={description}
            onChangeText={setDescription}
            placeholder={isTransfer ? 'Ex.: Reserva do mês' : 'Ex.: Almoço, Uber, Netflix'}
            returnKeyType="done"
          />
        </Field>

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
            {subcategories.length > 0 && (
              <View style={[styles.wrap, styles.subRow]}>
                {subcategories.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    icon={c.icon}
                    color={c.color}
                    selected={categoryId === c.id}
                    onPress={() => setCategoryId(categoryId === c.id ? selectedParentId : c.id)}
                  />
                ))}
              </View>
            )}
          </Field>
        )}

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

        <Field label="Data">
          <DateField value={date} onChange={setDate} />
        </Field>

        <Field label="Observação">
          <TextField
            value={notes}
            onChangeText={setNotes}
            placeholder="Opcional"
            multiline
            style={styles.notes}
          />
        </Field>

        <View style={styles.actions}>
          <Button title="Salvar" onPress={onSave} disabled={!canSave} />
          {id && <Button title="Apagar lançamento" variant="danger" onPress={onDelete} />}
        </View>
      </FormScroll>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  subRow: {
    marginTop: Spacing.one,
  },
  notes: {
    minHeight: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  actions: {
    gap: Spacing.two,
  },
});
