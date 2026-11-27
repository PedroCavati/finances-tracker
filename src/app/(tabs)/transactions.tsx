import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { TransactionList } from '@/components/transaction-list';
import { Chip, EmptyState, Field, IconButton, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listAccounts, listCategories, listTransactions, type TransactionFilters } from '@/db/queries';
import type { TransactionKind } from '@/db/types';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { monthRange, today } from '@/lib/dates';
import { formatMoney, formatSignedMoney } from '@/lib/money';

// ─── Opções dos filtros ────────────────────────────────────────────────────

type Period = 'month' | 'last_month' | 'three_months' | 'year' | 'all';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
  { value: 'three_months', label: '3 meses' },
  { value: 'year', label: 'Este ano' },
  { value: 'all', label: 'Tudo' },
];

const KINDS: { value: TransactionKind | null; label: string }[] = [
  { value: null, label: 'Todos' },
  { value: 'expense', label: 'Despesas' },
  { value: 'income', label: 'Receitas' },
  { value: 'transfer', label: 'Transferências' },
];

/** Máximo de lançamentos carregados de uma vez; acima disso aparece um aviso no fim da lista. */
const LIMIT = 300;

/** Datas de início e fim de cada período. "Tudo" não tem limite de datas. */
function periodRange(period: Period, now: string): { start?: string; end?: string } {
  switch (period) {
    case 'month':
      return monthRange(now);
    case 'last_month':
      return monthRange(now, -1);
    case 'three_months':
      return { start: monthRange(now, -2).start, end: monthRange(now).end };
    case 'year':
      return { start: `${now.slice(0, 4)}-01-01`, end: `${now.slice(0, 4)}-12-31` };
    case 'all':
      return {};
  }
}

// ─── Tela ──────────────────────────────────────────────────────────────────

/**
 * Aba Lançamentos: busca, filtros (período, tipo, e em "Mais filtros" conta e categoria),
 * totais do que está filtrado e a lista. O parâmetro `accountId` abre já filtrado por uma conta.
 */
export default function TransactionsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const now = today();

  // Filtros escolhidos
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('month');
  const [kind, setKind] = useState<TransactionKind | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);

  // Vindo de "Ver lançamentos" numa conta: aplica o filtro da conta uma vez por navegação.
  const [appliedParam, setAppliedParam] = useState<string | undefined>(undefined);
  if (params.accountId && params.accountId !== appliedParam) {
    setAppliedParam(params.accountId);
    setAccountId(Number(params.accountId));
    setPeriod('all');
    setShowMore(true);
  }

  // Dados do banco
  const filters: TransactionFilters = {
    ...periodRange(period, now),
    search,
    kind: kind ?? undefined,
    accountId: accountId ?? undefined,
    categoryId: categoryId ?? undefined,
    limit: LIMIT,
  };
  const { data: items } = useQuery((db) => listTransactions(db, filters), JSON.stringify(filters));
  const { data: accounts } = useQuery((db) => listAccounts(db, now, true), now);
  const { data: categories } = useQuery((db) => listCategories(db), 'all');

  // Valores calculados
  // Só categorias principais, do tipo escolhido (filtrar a principal já inclui as subcategorias).
  const topCategories = (categories ?? []).filter(
    (c) => c.parent_id === null && (kind === null || kind === c.kind)
  );

  // Totais do que está na lista (transferências não entram).
  let income = 0;
  let expense = 0;
  for (const t of items ?? []) {
    if (t.kind === 'income') income += t.amount;
    if (t.kind === 'expense') expense += t.amount;
  }

  // Quantos filtros de "Mais filtros" estão ativos, e se há algum filtro fora do padrão.
  const activeExtra = (accountId ? 1 : 0) + (categoryId ? 1 : 0);
  const hasFilters = !!search || period !== 'month' || kind !== null || activeExtra > 0;

  // Ações
  function clearFilters() {
    setSearch('');
    setPeriod('month');
    setKind(null);
    setAccountId(null);
    setCategoryId(null);
    setAppliedParam(undefined);
    router.setParams({ accountId: undefined });
  }

  return (
    <Screen
      title="Lançamentos"
      actions={
        <>
          <IconButton
            icon={{ ios: 'repeat', android: 'repeat', web: 'repeat' }}
            label="Recorrentes"
            onPress={() => router.push('/recurrences')}
          />
          <IconButton
            icon={{ ios: 'plus', android: 'add', web: 'add' }}
            label="Novo lançamento"
            filled
            onPress={() => router.push({ pathname: '/transaction', params: { kind: kind ?? 'expense' } })}
          />
        </>
      }>
      {/* Busca */}
      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar lançamentos"
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
      />

      {/* Período */}
      <ChipRow>
        {PERIODS.map((p) => (
          <Chip key={p.value} label={p.label} selected={period === p.value} onPress={() => setPeriod(p.value)} />
        ))}
      </ChipRow>

      {/* Tipo. Trocar o tipo limpa a categoria, que pode não existir no novo tipo. */}
      <ChipRow>
        {KINDS.map((k) => (
          <Chip
            key={k.label}
            label={k.label}
            selected={kind === k.value}
            onPress={() => {
              setKind(k.value);
              setCategoryId(null);
            }}
          />
        ))}
      </ChipRow>

      {/* "Mais filtros" e "Limpar filtros" */}
      <View style={styles.moreRow}>
        <Pressable onPress={() => setShowMore((v) => !v)} hitSlop={8}>
          <ThemedText type="small" style={{ color: theme.tint }}>
            {showMore ? 'Menos filtros' : `Mais filtros${activeExtra ? ` (${activeExtra})` : ''}`}
          </ThemedText>
        </Pressable>
        {hasFilters && (
          <Pressable onPress={clearFilters} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              Limpar filtros
            </ThemedText>
          </Pressable>
        )}
      </View>

      {/* Conta e categoria */}
      {showMore && (
        <>
          <Field label="Conta">
            <ChipRow>
              <Chip label="Todas" selected={accountId === null} onPress={() => setAccountId(null)} />
              {(accounts ?? []).map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  icon={a.icon}
                  color={a.color}
                  selected={accountId === a.id}
                  onPress={() => setAccountId(a.id)}
                />
              ))}
            </ChipRow>
          </Field>
          {kind !== 'transfer' && (
            <Field label="Categoria">
              <ChipRow>
                <Chip label="Todas" selected={categoryId === null} onPress={() => setCategoryId(null)} />
                {topCategories.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    icon={c.icon}
                    color={c.color}
                    selected={categoryId === c.id}
                    onPress={() => setCategoryId(c.id)}
                  />
                ))}
              </ChipRow>
            </Field>
          )}
        </>
      )}

      {/* Totais */}
      {items && items.length > 0 && (
        <View style={[styles.totals, { backgroundColor: theme.backgroundElement }]}>
          <Total label="Receitas" value={formatMoney(income)} color={theme.income} />
          <Total label="Despesas" value={formatMoney(expense)} color={theme.expense} />
          <Total label="Resultado" value={formatSignedMoney(income - expense)} />
        </View>
      )}

      {/* Lista */}
      {items && items.length === 0 && (
        <EmptyState
          title={hasFilters ? 'Nada encontrado' : 'Nenhum lançamento neste mês'}
          message={hasFilters ? 'Tente outro período ou limpe os filtros.' : 'Toque em + para registrar um.'}
        />
      )}

      {items && items.length > 0 && <TransactionList items={items} accountId={accountId ?? undefined} />}

      {items && items.length >= LIMIT && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.limitNote}>
          Mostrando os {LIMIT} lançamentos mais recentes. Use os filtros para ver os mais antigos.
        </ThemedText>
      )}
    </Screen>
  );
}

// ─── Partes da tela ────────────────────────────────────────────────────────

/** Linha de chips com rolagem horizontal, que vai de borda a borda da tela. */
function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      style={styles.chipScroll}>
      {children}
    </ScrollView>
  );
}

/** Um dos três totais acima da lista. */
function Total({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.totalItem}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText
        type="smallBold"
        style={[styles.tabular, color ? { color } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </View>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Filtros
  chipScroll: {
    marginHorizontal: -Spacing.three,
  },
  chipRow: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  moreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // Totais e lista
  totals: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: 12,
    gap: Spacing.two,
  },
  totalItem: {
    flex: 1,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  limitNote: {
    textAlign: 'center',
  },
});
