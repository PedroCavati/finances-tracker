export type TransactionKind = 'income' | 'expense' | 'transfer';
export type CategoryKind = 'income' | 'expense';
export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card' | 'investment';

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

export type Category = {
  id: number;
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
  parent_id: number | null;
};

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
