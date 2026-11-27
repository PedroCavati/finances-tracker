/**
 * Tipos das tabelas do banco e rótulos em português.
 * Valores em dinheiro são centavos inteiros; datas são texto "YYYY-MM-DD"; booleanos são 0 | 1.
 */

// ─── Contas ────────────────────────────────────────────────────────────────

export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card' | 'investment';

/** Conta (corrente, cartão, carteira...). Valores em centavos. */
export type Account = {
  id: number;
  name: string;
  type: AccountType;
  initial_balance: number; // centavos
  color: string;
  icon: string;
  archived: number; // 0 | 1
};

/** Conta com o saldo calculado até uma data (saldo inicial + lançamentos). */
export type AccountWithBalance = Account & { balance: number };

/** Dados para criar ou editar uma conta. Arquivar é uma ação à parte. */
export type AccountInput = Omit<Account, 'id' | 'archived'>;

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  cash: 'Dinheiro',
  credit_card: 'Cartão de crédito',
  investment: 'Investimento',
};

// ─── Categorias ────────────────────────────────────────────────────────────

export type CategoryKind = 'income' | 'expense';

/** Categoria de receita ou despesa. Com `parent_id`, é uma subcategoria. */
export type Category = {
  id: number;
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
  parent_id: number | null;
};

export type CategoryInput = Omit<Category, 'id'>;

// ─── Lançamentos ───────────────────────────────────────────────────────────

export type TransactionKind = 'income' | 'expense' | 'transfer';

/** Lançamento. `to_account_id` só existe em transferências; `category_id`, só em receitas e despesas. */
export type Transaction = {
  id: number;
  kind: TransactionKind;
  amount: number; // centavos, sempre positivo
  date: string; // YYYY-MM-DD
  description: string;
  notes: string;
  account_id: number;
  to_account_id: number | null;
  category_id: number | null;
  recurrence_id: number | null; // recorrência que gerou este lançamento, se houver
  created_at: string;
};

/** Lançamento com os nomes/cores já resolvidos para exibir em listas. */
export type TransactionRow = Transaction & {
  account_name: string;
  to_account_name: string | null;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  parent_category_name: string | null;
};

/** Dados para criar ou editar, sem os campos gerados pelo banco. `recurrence_id` só ao gerar a partir de uma recorrência. */
export type TransactionInput = Omit<Transaction, 'id' | 'created_at' | 'recurrence_id'> & {
  recurrence_id?: number | null;
};

// ─── Orçamento ─────────────────────────────────────────────────────────────

/** Situação do orçamento de uma categoria principal de despesa num mês. */
export type BudgetProgress = {
  category_id: number;
  name: string;
  color: string;
  icon: string;
  budget: number; // limite em centavos; 0 = sem limite
  spent: number; // gasto no mês em centavos, somando as subcategorias
};

// ─── Recorrências ──────────────────────────────────────────────────────────

export type Frequency = 'weekly' | 'monthly' | 'yearly';

/** Ajuste quando a data cai em fim de semana ou feriado. */
export type BusinessDayRule = 'none' | 'next' | 'previous';

/** Regra de um lançamento recorrente. `next_date` é a próxima ocorrência ainda não gerada. */
export type Recurrence = {
  id: number;
  kind: TransactionKind;
  amount: number; // centavos
  description: string;
  notes: string;
  account_id: number;
  to_account_id: number | null;
  category_id: number | null;
  frequency: Frequency;
  anchor_date: string; // primeira ocorrência; define o dia de referência
  next_date: string; // data nominal, antes do ajuste de dia útil (ver actualDate)
  auto: number; // 1 = gera sozinho; 0 = pede confirmação
  paused: number; // 0 | 1
  business_days: BusinessDayRule;
  business_day_n: number | null; // mensal no "Nº dia útil do mês"; null = usa o dia da data
  notify: number; // 1 = avisa por notificação no dia (etapa 10)
  created_at: string;
};

/** Recorrência com os nomes de conta e categoria resolvidos, para listas. */
export type RecurrenceRow = Recurrence & {
  account_name: string;
  to_account_name: string | null;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  /** Categoria principal (a própria, ou a mãe se for subcategoria). Usada no orçamento. */
  budget_category_id: number | null;
};

export type RecurrenceInput = Omit<Recurrence, 'id' | 'created_at'>;

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

export const BUSINESS_DAY_LABELS: Record<BusinessDayRule, string> = {
  none: 'Na data exata',
  next: 'Dia útil seguinte',
  previous: 'Dia útil anterior',
};
