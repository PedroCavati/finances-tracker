import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AmountInput, IconPicker, SwatchPicker } from '@/components/pickers';
import { FormScroll } from '@/components/screen';
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

const DEFAULT_ICON: Record<AccountType, string> = {
  checking: 'bank',
  savings: 'piggy',
  cash: 'wallet',
  credit_card: 'card',
  investment: 'invest',
};

export default function AccountForm() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : undefined;

  const [loaded, setLoaded] = useState<Account | null | undefined>(id ? undefined : null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [balance, setBalance] = useState(0);
  const [negative, setNegative] = useState(false);
  const [color, setColor] = useState('#0090FF');
  const [icon, setIcon] = useState('bank');
  const [saving, setSaving] = useState(false);

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
    });
  }, [db, id]);

  const canSave = name.trim().length > 0 && !saving;

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await saveAccount(
        db,
        { name: name.trim(), type, initial_balance: negative ? -balance : balance, color, icon },
        id
      );
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert('Não foi possível salvar', String(error));
    }
  }

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

  if (id && loaded === undefined) return <Stack.Screen options={{ title: 'Conta' }} />;

  return (
    <>
      <Stack.Screen
        options={{
          title: id ? 'Editar conta' : 'Nova conta',
          headerLeft: () => <HeaderButton title="Cancelar" onPress={() => router.back()} />,
        }}
      />
      <FormScroll>
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

        <Field label={id ? 'Saldo inicial' : 'Saldo atual'}>
          <Segmented
            value={negative ? 'neg' : 'pos'}
            onChange={(v) => setNegative(v === 'neg')}
            options={[
              { value: 'pos', label: 'Positivo' },
              { value: 'neg', label: 'Negativo / dívida', color: theme.expense },
            ]}
          />
          <AmountInput value={balance} onChange={setBalance} color={negative ? theme.expense : undefined} />
        </Field>

        <Field label="Cor">
          <SwatchPicker value={color} onChange={setColor} />
        </Field>

        <Field label="Ícone">
          <IconPicker icons={ACCOUNT_ICON_KEYS} value={icon} color={color} onChange={setIcon} />
        </Field>

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

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
  },
});
