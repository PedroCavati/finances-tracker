import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BudgetBar, budgetLevel, useBudgetColor } from '@/components/budget-bar';
import { MonthSwitcher } from '@/components/month-switcher';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, EmptyState, IconButton, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { budgetProgress, categorySpending, listCategories } from '@/db/queries';
import type { BudgetProgress, Category, CategoryKind } from '@/db/types';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { monthKey, monthRange, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { committedByCategory } from '@/lib/recurrences';

// ─── Tela ─────────────────────────────────────────────────────────────────────

/**
 * Aba Categorias: alterna entre despesas e receitas. Em despesas, mostra o resumo do
 * orçamento do mês (com seletor de mês) e, em cada categoria, gasto, limite e previsto.
 */
export default function CategoriesScreen() {
  const theme = useTheme();

  // Tipo e mês escolhidos (0 = mês atual)
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [monthOffset, setMonthOffset] = useState(0);

  const monthStart = monthRange(today(), monthOffset).start;
  const month = monthKey(monthStart);

  // Dados do banco
  const { data: categories } = useQuery((db) => listCategories(db, kind), kind);
  const { data: progress } = useQuery((db) => budgetProgress(db, month), month);
  const { data: spending } = useQuery((db) => categorySpending(db, month), `spending:${month}`);
  const { data: committed } = useQuery((db) => committedByCategory(db, month), `committed:${month}`);

  // Árvore: categorias principais e as subcategorias de cada uma
  const parents = categories?.filter((c) => c.parent_id === null) ?? [];
  const childrenOf = (id: number) => categories?.filter((c) => c.parent_id === id) ?? [];

  // Orçamento. `progress` é por categoria principal (já soma as subcategorias);
  // `spentById` é o gasto de cada categoria sozinha, usado nas subcategorias.
  const spentById = new Map((spending ?? []).map((s) => [s.category_id, s.spent]));
  const progressById = new Map((progress ?? []).map((p) => [p.category_id, p]));
  const withBudget = (progress ?? []).filter((p) => p.budget > 0);

  // Totais do card de resumo. O que foi gasto em categorias sem limite aparece à parte.
  const totalBudget = withBudget.reduce((sum, p) => sum + p.budget, 0);
  const totalSpent = withBudget.reduce((sum, p) => sum + p.spent, 0);
  const totalCommitted = withBudget.reduce((sum, p) => sum + (committed?.get(p.category_id) ?? 0), 0);
  const spentWithoutBudget = (progress ?? [])
    .filter((p) => p.budget === 0)
    .reduce((sum, p) => sum + p.spent, 0);

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
      {/* Despesas / Receitas */}
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'expense', label: 'Despesas', color: theme.expense },
          { value: 'income', label: 'Receitas', color: theme.income },
        ]}
      />

      {/* Resumo do orçamento (só em despesas) */}
      {kind === 'expense' && (
        <Card style={styles.summary}>
          <MonthSwitcher
            monthStart={monthStart}
            onMove={(delta) => setMonthOffset((m) => m + delta)}
            onReset={() => setMonthOffset(0)}
          />
          {totalBudget > 0 ? (
            <>
              <View style={styles.summaryValues}>
                <ThemedText style={styles.summarySpent}>{formatMoney(totalSpent)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  de {formatMoney(totalBudget)}
                </ThemedText>
              </View>
              <BudgetBar spent={totalSpent} budget={totalBudget} committed={totalCommitted} />
              {totalCommitted > 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  + {formatMoney(totalCommitted)} previsto em recorrentes
                </ThemedText>
              )}
              {spentWithoutBudget > 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  + {formatMoney(spentWithoutBudget)} em categorias sem limite
                </ThemedText>
              )}
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Nenhum limite definido. Toque numa categoria para definir quanto quer gastar por mês.
            </ThemedText>
          )}
        </Card>
      )}

      {/* Lista: cada principal seguida das suas subcategorias */}
      {categories && parents.length === 0 && (
        <EmptyState title="Nenhuma categoria" message="Toque em + para criar uma." />
      )}

      {parents.length > 0 && (
        <Card style={styles.list}>
          {parents.map((parent, index) => (
            <Fragment key={parent.id}>
              {index > 0 && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
              <CategoryRow
                category={parent}
                progress={kind === 'expense' ? progressById.get(parent.id) : undefined}
                committed={kind === 'expense' ? committed?.get(parent.id) : undefined}
              />
              {childrenOf(parent.id).map((child) => (
                <View key={child.id} style={styles.child}>
                  <CategoryRow
                    category={child}
                    small
                    spent={kind === 'expense' ? spentById.get(child.id) : undefined}
                  />
                </View>
              ))}
            </Fragment>
          ))}
        </Card>
      )}
    </Screen>
  );
}

// ─── Lista ────────────────────────────────────────────────────────────────────

/**
 * Uma categoria. Principal de despesa: recebe `progress` (gasto/limite e barra) e `committed`.
 * Subcategoria (`small`): recebe só `spent`, o gasto dela no mês.
 */
function CategoryRow({
  category,
  small,
  progress,
  spent,
  committed = 0,
}: {
  category: Category;
  small?: boolean;
  progress?: BudgetProgress;
  spent?: number;
  committed?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/category', params: { id: String(category.id) } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <Badge icon={category.icon} color={category.color} size={small ? 30 : 40} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <ThemedText type={small ? 'small' : 'default'} style={styles.name} numberOfLines={1}>
            {category.name}
          </ThemedText>
          {progress && <BudgetAmount progress={progress} />}
          {spent !== undefined && spent > 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.amount}>
              {formatMoney(spent)}
            </ThemedText>
          )}
        </View>
        {progress && progress.budget > 0 && (
          <BudgetBar spent={progress.spent} budget={progress.budget} committed={committed} />
        )}
        {committed > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            + {formatMoney(committed)} previsto
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

/** "R$ 181,99 / R$ 250,00" com limite; só o gasto sem limite; nada se não gastou. */
function BudgetAmount({ progress }: { progress: BudgetProgress }) {
  const { spent, budget } = progress;
  const overColor = useBudgetColor('over');

  if (budget === 0) {
    if (spent === 0) return null;
    return (
      <ThemedText type="small" themeColor="textSecondary" style={styles.amount}>
        {formatMoney(spent)}
      </ThemedText>
    );
  }

  const over = budgetLevel(spent, budget) === 'over';
  return (
    <ThemedText
      type="small"
      themeColor="textSecondary"
      style={[styles.amount, over && { color: overColor }]}>
      {formatMoney(spent)} / {formatMoney(budget)}
    </ThemedText>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Resumo
  summary: {
    gap: Spacing.two,
  },
  summaryValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  summarySpent: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },

  // Lista
  list: {
    paddingVertical: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: Spacing.two,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  name: {
    flex: 1,
  },
  amount: {
    fontVariant: ['tabular-nums'],
  },
  child: {
    paddingLeft: 52,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
});