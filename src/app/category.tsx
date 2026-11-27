import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { IconPicker, SwatchPicker } from '@/components/pickers';
import { FormScroll } from '@/components/screen';
import { Button, Chip, Field, HeaderButton, Segmented, TextField } from '@/components/ui';
import { CATEGORY_ICON_KEYS } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { deleteCategory, getCategory, listCategories, saveCategory } from '@/db/queries';
import type { Category, CategoryKind } from '@/db/types';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';

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

  const { data: all } = useQuery((d) => listCategories(d, kind), kind);
  // Só um nível de subcategoria: a mãe tem que ser de topo e não pode ser a própria.
  const parentOptions = (all ?? []).filter((c) => c.parent_id === null && c.id !== id);
  const hasChildren = !!id && (all ?? []).some((c) => c.parent_id === id);

  useEffect(() => {
    if (!id) return;
    getCategory(db, id).then((category: Category | null) => {
      if (category) {
        setName(category.name);
        setKind(category.kind);
        setColor(category.color);
        setIcon(category.icon);
        setParentId(category.parent_id);
      }
      setLoaded(true);
    });
  }, [db, id]);

  const canSave = name.trim().length > 0 && !saving;

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await saveCategory(db, { name: name.trim(), kind, color, icon, parent_id: parentId }, id);
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
});
