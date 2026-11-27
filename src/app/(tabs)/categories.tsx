import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, EmptyState, IconButton, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listCategories } from '@/db/queries';
import type { Category, CategoryKind } from '@/db/types';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';

export default function CategoriesScreen() {
  const theme = useTheme();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const { data: categories } = useQuery((db) => listCategories(db, kind), kind);

  const parents = categories?.filter((c) => c.parent_id === null) ?? [];
  const childrenOf = (id: number) => categories?.filter((c) => c.parent_id === id) ?? [];

  return (
    <Screen
      title="Categorias"
      actions={
        <IconButton
          icon={{ ios: 'plus', android: 'add', web: 'add' }}
          label="Nova categoria"
          filled
          onPress={() => router.push({ pathname: '/category', params: { kind } })}
        />
      }>
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'expense', label: 'Despesas', color: theme.expense },
          { value: 'income', label: 'Receitas', color: theme.income },
        ]}
      />

      {categories && parents.length === 0 && (
        <EmptyState title="Nenhuma categoria" message="Toque em + para criar uma." />
      )}

      {parents.length > 0 && (
        <Card style={styles.list}>
          {parents.map((parent, index) => (
            <Fragment key={parent.id}>
              {index > 0 && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
              <CategoryRow category={parent} />
              {childrenOf(parent.id).map((child) => (
                <View key={child.id} style={styles.child}>
                  <CategoryRow category={child} small />
                </View>
              ))}
            </Fragment>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function CategoryRow({ category, small }: { category: Category; small?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/category', params: { id: String(category.id) } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <Badge icon={category.icon} color={category.color} size={small ? 30 : 40} />
      <ThemedText type={small ? 'small' : 'default'} style={styles.name} numberOfLines={1}>
        {category.name}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: Spacing.two,
  },
  child: {
    paddingLeft: 52,
  },
  name: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
});
