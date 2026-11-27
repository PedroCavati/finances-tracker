export type TransactionKind = 'income' | 'expense' | 'transfer';
export type CategoryKind = 'income' | 'expense';
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

export type AccountWithBalance = Account & { balance: number };

/** Categoria de receita ou despesa. Com `parent_id`, é uma subcategoria. */
export type Category = {
  id: number;
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
  parent_id: number | null;
};

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

/** Dados para criar ou editar, sem os campos gerados pelo banco. */
export type TransactionInput = Omit<Transaction, 'id' | 'created_at'>;
export type AccountInput = Omit<Account, 'id' | 'archived'>;
export type CategoryInput = Omit<Category, 'id'>;

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  cash: 'Dinheiro',
  credit_card: 'Cartão de crédito',
  investment: 'Investimento',
};

/** Situação do orçamento de uma categoria principal de despesa num mês. */
export type BudgetProgress = {
  category_id: number;
  name: string;
  color: string;
  icon: string;
  budget: number; // limite em centavos; 0 = sem limite
  spent: number; // gasto no mês em centavos, somando as subcategorias
};