import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';

import { notifyDataChanged } from './events';
import type {
  Account,
  AccountInput,
  AccountWithBalance,
  Category,
  CategoryInput,
  CategoryKind,
  Transaction,
  TransactionInput,
  TransactionKind,
  TransactionRow,
} from './types';

// ─── Contas ────────────────────────────────────────────────────────────────

/**
 * Saldo = saldo inicial + receitas − despesas − transferências enviadas + recebidas.
 * Só conta lançamentos até `untilDate` (inclusive), para não somar lançamentos futuros.
 */
const BALANCE_SQL = `
  a.initial_balance + COALESCE((
    SELECT SUM(CASE
      WHEN t.kind = 'income' AND t.account_id = a.id THEN t.amount
      WHEN t.kind = 'expense' AND t.account_id = a.id THEN -t.amount
      WHEN t.kind = 'transfer' AND t.account_id = a.id THEN -t.amount
      WHEN t.kind = 'transfer' AND t.to_account_id = a.id THEN t.amount
      ELSE 0 END)
    FROM transactions t
    WHERE (t.account_id = a.id OR t.to_account_id = a.id) AND t.date <= $until
  ), 0)
`;

export function listAccounts(db: SQLiteDatabase, untilDate: string, includeArchived = false) {
  return db.getAllAsync<AccountWithBalance>(
    `SELECT a.*, ${BALANCE_SQL} AS balance
     FROM accounts a
     ${includeArchived ? '' : 'WHERE a.archived = 0'}
     ORDER BY a.archived, a.name COLLATE NOCASE`,
    { $until: untilDate }
  );
}

export function getAccount(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Account>('SELECT * FROM accounts WHERE id = ?', id);
}

export async function saveAccount(db: SQLiteDatabase, input: AccountInput, id?: number) {
  if (id) {
    await db.runAsync(
      'UPDATE accounts SET name = ?, type = ?, initial_balance = ?, color = ?, icon = ? WHERE id = ?',
      input.name,
      input.type,
      input.initial_balance,
      input.color,
      input.icon,
      id
    );
  } else {
    await db.runAsync(
      'INSERT INTO accounts (name, type, initial_balance, color, icon) VALUES (?, ?, ?, ?, ?)',
      input.name,
      input.type,
      input.initial_balance,
      input.color,
      input.icon
    );
  }
  notifyDataChanged();
}

export async function setAccountArchived(db: SQLiteDatabase, id: number, archived: boolean) {
  await db.runAsync('UPDATE accounts SET archived = ? WHERE id = ?', archived ? 1 : 0, id);
  notifyDataChanged();
}

export async function countAccountTransactions(db: SQLiteDatabase, id: number) {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE account_id = ? OR to_account_id = ?',
    id,
    id
  );
  return row?.n ?? 0;
}

/** Apaga a conta e todos os lançamentos dela (ON DELETE CASCADE). */
export async function deleteAccount(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM accounts WHERE id = ?', id);
  notifyDataChanged();
}

// ─── Categorias ────────────────────────────────────────────────────────────

export function listCategories(db: SQLiteDatabase, kind?: CategoryKind) {
  return db.getAllAsync<Category>(
    `SELECT * FROM categories ${kind ? 'WHERE kind = ?' : ''}
     ORDER BY kind DESC, name COLLATE NOCASE`,
    kind ? [kind] : []
  );
}

export function getCategory(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Category>('SELECT * FROM categories WHERE id = ?', id);
}

export async function saveCategory(db: SQLiteDatabase, input: CategoryInput, id?: number) {
  if (id) {
    await db.runAsync(
      'UPDATE categories SET name = ?, kind = ?, color = ?, icon = ?, parent_id = ? WHERE id = ?',
      input.name,
      input.kind,
      input.color,
      input.icon,
      input.parent_id,
      id
    );
  } else {
    await db.runAsync(
      'INSERT INTO categories (name, kind, color, icon, parent_id) VALUES (?, ?, ?, ?, ?)',
      input.name,
      input.kind,
      input.color,
      input.icon,
      input.parent_id
    );
  }
  notifyDataChanged();
}

/** Apaga a categoria e as subcategorias. Os lançamentos ficam "sem categoria". */
export async function deleteCategory(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM categories WHERE id = ?', id);
  notifyDataChanged();
}

// ─── Lançamentos ───────────────────────────────────────────────────────────

export type TransactionFilters = {
  search?: string;
  start?: string;
  end?: string;
  kind?: TransactionKind;
  accountId?: number;
  /** Inclui as subcategorias da categoria escolhida. */
  categoryId?: number;
  limit?: number;
};

export function listTransactions(db: SQLiteDatabase, filters: TransactionFilters = {}) {
  const where: string[] = [];
  const params: SQLiteBindValue[] = [];

  if (filters.start) {
    where.push('t.date >= ?');
    params.push(filters.start);
  }
  if (filters.end) {
    where.push('t.date <= ?');
    params.push(filters.end);
  }
  if (filters.kind) {
    where.push('t.kind = ?');
    params.push(filters.kind);
  }
  if (filters.accountId) {
    where.push('(t.account_id = ? OR t.to_account_id = ?)');
    params.push(filters.accountId, filters.accountId);
  }
  if (filters.categoryId) {
    where.push('(t.category_id = ? OR c.parent_id = ?)');
    params.push(filters.categoryId, filters.categoryId);
  }
  const search = filters.search?.trim();
  if (search) {
    where.push(`(t.description LIKE ? ESCAPE '\\' OR t.notes LIKE ? ESCAPE '\\'
      OR c.name LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\')`);
    const like = `%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    params.push(like, like, like, like);
  }

  return db.getAllAsync<TransactionRow>(
    `SELECT t.*,
       a.name AS account_name,
       ta.name AS to_account_name,
       c.name AS category_name,
       c.color AS category_color,
       c.icon AS category_icon,
       p.name AS parent_category_name
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN accounts ta ON ta.id = t.to_account_id
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories p ON p.id = c.parent_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY t.date DESC, t.id DESC
     ${filters.limit ? `LIMIT ${Math.floor(filters.limit)}` : ''}`,
    params
  );
}

export function getTransaction(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Transaction>('SELECT * FROM transactions WHERE id = ?', id);
}

export async function saveTransaction(db: SQLiteDatabase, input: TransactionInput, id?: number) {
  const isTransfer = input.kind === 'transfer';
  const values = [
    input.kind,
    input.amount,
    input.date,
    input.description.trim(),
    input.notes.trim(),
    input.account_id,
    isTransfer ? input.to_account_id : null,
    isTransfer ? null : input.category_id,
  ];
  if (id) {
    await db.runAsync(
      `UPDATE transactions SET kind = ?, amount = ?, date = ?, description = ?, notes = ?,
         account_id = ?, to_account_id = ?, category_id = ? WHERE id = ?`,
      ...values,
      id
    );
  } else {
    await db.runAsync(
      `INSERT INTO transactions (kind, amount, date, description, notes, account_id, to_account_id, category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ...values
    );
  }
  notifyDataChanged();
}

export async function deleteTransaction(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
  notifyDataChanged();
}

// ─── Resumos ───────────────────────────────────────────────────────────────

/** Receitas e despesas no período. Transferências entre contas não entram. */
export async function periodSummary(db: SQLiteDatabase, start: string, end: string) {
  const row = await db.getFirstAsync<{ income: number | null; expense: number | null }>(
    `SELECT
       SUM(CASE WHEN kind = 'income' THEN amount END) AS income,
       SUM(CASE WHEN kind = 'expense' THEN amount END) AS expense
     FROM transactions WHERE date BETWEEN ? AND ?`,
    start,
    end
  );
  const income = row?.income ?? 0;
  const expense = row?.expense ?? 0;
  return { income, expense, net: income - expense };
}
