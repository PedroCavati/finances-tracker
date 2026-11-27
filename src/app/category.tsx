import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AmountInput, IconPicker, SwatchPicker } from '@/components/pickers';
import { FormScroll } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Field, HeaderButton, Segmented, TextField } from '@/components/ui';
import { CATEGORY_ICON_KEYS } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { deleteCategory, getBudget, getCategory, listCategories, saveCategory, setBudget } from '@/db/queries';
import type { Category, CategoryKind } from '@/db/types';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { monthKey, today } from '@/lib/dates';
import { ensureNotificationPermission } from '@/lib/notifications';

export default function CategoryForm() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string; kind?: CategoryKind }>();
  const id = params.id ? Number(params.id) : undefined;

  const [loaded, setLoaded] = useState(!id);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>(params.kind ?? 'expense');
  const [color, setColor] = useState('#0090FF');
  const [icon, setIcon] = useState('other');
  const [parentId, setParentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState(0);
  const [savedBudget, setSavedBudget] = useState(0);

  const { data: all } = useQuery((d) => listCategories(d, kind), kind);
  // Só um nível de subcategoria: a mãe tem que ser de topo e não pode ser a própria.
  const parentOptions = (all ?? []).filter((c) => c.parent_id === null && c.id !== id);
  const hasChildren = !!id && (all ?? []).some((c) => c.parent_id === id);
  const canHaveBudget = kind === 'expense' && parentId === null;

  useEffect(() => {
    if (!id) return;
    Promise.all([getCategory(db, id), getBudget(db, id, monthKey(today()))]).then(
      ([category, budget]: [Category | null, number]) => {
        if (category) {
          setName(category.name);
          setKind(category.kind);
          setColor(category.color);
          setIcon(category.icon);
          setParentId(category.parent_id);
        }
        setBudgetAmount(budget);
        setSavedBudget(budget);
        setLoaded(true);
      }
    );
  }, [db, id]);

  const canSave = name.trim().length > 0 && !saving;

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const categoryId = await saveCategory(
        db,
        { name: name.trim(), kind, color, icon, parent_id: parentId },
        id
      );
      const newBudget = canHaveBudget ? budgetAmount : 0;
      if (newBudget !== savedBudget) {
        await setBudget(db, categoryId, newBudget, monthKey(today()));
      }
      // É aqui que os avisos passam a fazer sentido: pede permissão (só pergunta uma vez).
      if (newBudget > 0) await ensureNotificationPermission();
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert('Não foi possível salvar', String(error));
    }
  }

  function onDelete() {
    if (!id) return;
    Alert.alert(
      'Apagar categoria?',
      `${hasChildren ? 'As subcategorias também serão apagadas. ' : ''}Os lançamentos continuam, mas ficam sem categoria. Isso não pode ser desfeito.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(db, id);
            router.back();
          },
        },
      ]
    );
  }

  if (!loaded) return <Stack.Screen options={{ title: 'Categoria' }} />;

  return (
    <>
      <Stack.Screen
        options={{
          title: id ? 'Editar categoria' : 'Nova categoria',
          headerLeft: () => <HeaderButton title="Cancelar" onPress={() => router.back()} />,
        }}
      />
      <FormScroll>
        <Field label="Nome">
          <TextField value={name} onChangeText={setName} placeholder="Ex.: Restaurantes" autoFocus={!id} />
        </Field>

        {/* Trocar o tipo de uma categoria existente bagunçaria lançamentos já feitos. */}
        {!id && (
          <Field label="Tipo">
            <Segmented
              value={kind}
              onChange={(k) => {
                setKind(k);
                setParentId(null);
              }}
              options={[
                { value: 'expense', label: 'Despesa', color: theme.expense },
                { value: 'income', label: 'Receita', color: theme.income },
              ]}
            />
          </Field>
        )}

        {!hasChildren && (
          <Field label="Subcategoria de">
            <View style={styles.wrap}>
              <Chip label="Nenhuma" selected={parentId === null} onPress={() => setParentId(null)} />
              {parentOptions.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  icon={p.icon}
                  color={p.color}
                  selected={parentId === p.id}
                  onPress={() => setParentId(p.id)}
                />
              ))}
            </View>
          </Field>
        )}

        {canHaveBudget && (
          <Field label="Limite mensal">
            <AmountInput value={budgetAmount} onChange={setBudgetAmount} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              {budgetAmount === 0
                ? 'Sem limite. Digite um valor para acompanhar quanto gasta nesta categoria.'
                : 'Vale a partir deste mês. Os meses anteriores mantêm o limite que tinham.'}
            </ThemedText>
          </Field>
        )}

        <Field label="Cor">
          <SwatchPicker value={color} onChange={setColor} />
        </Field>

        <Field label="Ícone">
          <IconPicker icons={CATEGORY_ICON_KEYS} value={icon} color={color} onChange={setIcon} />
        </Field>

        <View style={styles.actions}>
          <Button title="Salvar" onPress={onSave} disabled={!canSave} />
          {id && <Button title="Apagar categoria" variant="danger" onPress={onDelete} />}
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
  hint: {
    textAlign: 'center',
  },
});
