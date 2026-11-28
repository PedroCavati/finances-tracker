/**
 * Todas as leituras e escritas no banco, agrupadas por tabela.
 * Funções que gravam chamam `notifyDataChanged()` para as telas abertas se atualizarem.
 */
import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import { notifyDataChanged } from '@/db/events';
import type {
  Account,
  AccountInput,
  AccountWithBalance,
  BudgetProgress,
  Category,
  CategoryInput,
  CategoryKind,
  Recurrence,
  RecurrenceInput,
  RecurrenceRow,
  Transaction,
  TransactionInput,
  TransactionKind,
  TransactionRow,
} from '@/db/types';
import { CardMovement } from '@/lib/credit-card';

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

/** Contas com o saldo calculado até `untilDate`. As arquivadas só vêm com `includeArchived`. */
export function listAccounts(db: SQLiteDatabase, untilDate: string, includeArchived = false) {
  return db.getAllAsync<AccountWithBalance>(
    `SELECT a.*, ${BALANCE_SQL} AS balance
     FROM accounts a
     ${includeArchived ? '' : 'WHERE a.archived = 0'}
     ORDER BY a.archived, a.name COLLATE NOCASE`,
    { $until: untilDate }
  );
}

/** Uma conta pelo id, sem o saldo. */
export function getAccount(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Account>('SELECT * FROM accounts WHERE id = ?', id);
}

/**
 * Cria a conta (sem `id`) ou atualiza a existente (com `id`). Fechamento, vencimento e
 * limite só são gravados em cartão de crédito; nas outras contas ficam vazios.
*/
export async function saveAccount(db: SQLiteDatabase, input: AccountInput, id?: number) {
  const isCard = input.type === 'credit_card';
  const values = [
    input.name,
    input.type,
    input.initial_balance,
    input.color,
    input.icon,
    isCard ? (input.closing_day ?? null) : null,
    isCard ? (input.due_day ?? null) : null,
    isCard ? (input.credit_limit ?? 0) : 0,
  ]
  if (id) {
    await db.runAsync(
      `UPDATE accounts SET name = ?, type = ?, initial_balance = ?, color = ?, icon = ?,
       closing_day = ?, due_day = ?, credit_limit = ? WHERE id = ?`,
      ...values,
      id
    );
  } else {
    await db.runAsync(
      `INSERT INTO accounts (name, type, initial_balance, color, icon, closing_day, due_day, credit_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ...values
    );
  }
  notifyDataChanged();
}

/** Arquiva ou desarquiva: a conta some das listas e do saldo total, mas o histórico continua. */
export async function setAccountArchived(db: SQLiteDatabase, id: number, archived: boolean) {
  await db.runAsync('UPDATE accounts SET archived = ? WHERE id = ?', archived ? 1 : 0, id);
  notifyDataChanged();
}

/** Quantos lançamentos envolvem a conta, para avisar antes de apagá-la. */
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

/** Categorias e subcategorias de um tipo, ou de todos se `kind` não for informado. */
export function listCategories(db: SQLiteDatabase, kind?: CategoryKind) {
  return db.getAllAsync<Category>(
    `SELECT * FROM categories ${kind ? 'WHERE kind = ?' : ''}
     ORDER BY kind DESC, name COLLATE NOCASE`,
    kind ? [kind] : []
  );
}

/** Uma categoria pelo id. */
export function getCategory(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Category>('SELECT * FROM categories WHERE id = ?', id);
}

/** Cria a categoria (sem `id`) ou atualiza a existente. Devolve o id. */
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
    const result = await db.runAsync(
      'INSERT INTO categories (name, kind, color, icon, parent_id) VALUES (?, ?, ?, ?, ?)',
      input.name,
      input.kind,
      input.color,
      input.icon,
      input.parent_id
    );
    id = result.lastInsertRowId;
  }
  notifyDataChanged();
  return id;
}

/** Apaga a categoria e as subcategorias. Os lançamentos ficam "sem categoria". */
export async function deleteCategory(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM categories WHERE id = ?', id);
  notifyDataChanged();
}

// ─── Lançamentos ───────────────────────────────────────────────────────────

/** Filtros do histórico. Campos não informados não filtram. */
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

/** Lançamentos com os nomes de conta e categoria resolvidos, do mais recente ao mais antigo. */
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

/** Um lançamento pelo id, para o formulário de edição. */
export function getTransaction(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Transaction>('SELECT * FROM transactions WHERE id = ?', id);
}

/** Campos que o formulário edita. Transferências ignoram a categoria; receitas e despesas, a conta de destino. */
function editableValues(input: TransactionInput) {
  const isTransfer = input.kind === 'transfer';
  return [
    input.kind,
    input.amount,
    input.date,
    input.description.trim(),
    input.notes.trim(),
    input.account_id,
    isTransfer ? input.to_account_id : null,
    isTransfer ? null : input.category_id,
  ];
}

/** Insere um lançamento com os vínculos (recorrência, parcela) e devolve o id. Não avisa as telas. */
async function insertTransaction(db: SQLiteDatabase, input: TransactionInput) {
  const result = await db.runAsync(
    `INSERT INTO transactions (kind, amount, date, description, notes, account_id, to_account_id, category_id,
       recurrence_id, installment_group, installment_number, installment_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...editableValues(input),
    input.recurrence_id ?? null,
    input.installment_group ?? null,
    input.installment_number ?? null,
    input.installment_count ?? null
  );
  return result.lastInsertRowId;
}

/** Cria ou atualiza o lançamento. Ao editar, os vínculos (recorrência, parcela) não mudam. */
export async function saveTransaction(db: SQLiteDatabase, input: TransactionInput, id?: number) {
  if (id) {
    await db.runAsync(
      `UPDATE transactions SET kind = ?, amount = ?, date = ?, description = ?, notes = ?,
         account_id = ?, to_account_id = ?, category_id = ? WHERE id = ?`,
      ...editableValues(input),
      id
    );
  } else {
    await insertTransaction(db, input);
  }
  notifyDataChanged();
}

/** Apaga um lançamento. */
export async function deleteTransaction(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
  notifyDataChanged();
}

// ─── Parcelas ──────────────────────────────────────────────────────────────

/**
 * Cria uma compra parcelada: um lançamento por parcela, com o valor e a data de cada uma.
 * Todas ficam ligadas pelo `installment_group`, que é o id da 1ª parcela. Devolve esse id.
 */
export async function saveInstallments(
  db: SQLiteDatabase,
  input: TransactionInput,
  parcels: { amount: number, date: string }[]
) {
  let group = 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const count = parcels.length;
    const first = { ...input, ...parcels[0], installment_number: 1, installment_count: count };
    group = await insertTransaction(tx, first);
    await tx.runAsync('UPDATE transactions SET installment_group = ? WHERE id = ?', group, group);
    for (let i = 1; i < count; i++) {
      await insertTransaction(tx, {
        ...input,
        ...parcels[i],
        installment_group: group,
        installment_number: i + 1,
        installment_count: count,
      });
    }
  })
  notifyDataChanged();
  return group;
}

/** Parcelas de uma compra, da 1ª à última. */
export function listInstallments(db: SQLiteDatabase, group: number) {
  return db.getAllAsync<Transaction>(
    'SELECT * FROM transactions WHERE installment_group = ? ORDER BY installment_number',
    group
  );
}

/**
 * "Esta e as próximas": aplica descrição, observação, conta e categoria às parcelas a partir
 * de `fromNumber`. Valor e data continuam os de cada parcela.
 */
export async function updateInstallmentsFrom(
  db: SQLiteDatabase,
  group: number,
  fromNumber: number,
  input: Pick<TransactionInput, 'description' | 'notes' | 'account_id' | 'category_id'>
) {
  await db.runAsync(
    `UPDATE transactions SET description = ?, notes = ?, account_id = ?, category_id = ?
   WHERE installment_group = ? AND installment_number >= ?`,
    input.description.trim(),
    input.notes.trim(),
    input.account_id,
    input.category_id,
    group,
    fromNumber
  );
  notifyDataChanged();
}

/** "Esta e as próximas" ao apagar: remove as parcelas a partir de `fromNumber` (ex.: quitação antecipada). */
export async function deleteInstallmentsFrom(db: SQLiteDatabase, group: number, fromNumber: number) {
  await db.runAsync(
    'DELETE FROM transactions WHERE installment_group = ? AND installment_number >= ?',
    group,
    fromNumber
  );
  notifyDataChanged();
}

// ─── Cartão de crédito ────────────────────────────────────────────────────────

/** Cartões ativos com fechamento e vencimento definidos (os que têm fatura). */
export function listBillingCards(db: SQLiteDatabase) {
  return db.getAllAsync<Account>(
    `SELECT * FROM accounts
     WHERE type = 'credit_card' AND archived = 0 AND closing_day IS NOT NULL AND due_day IS NOT NULL
     ORDER BY name COLLATE NOCASE`
  );
}

/**
 * Todos os movimentos de um cartão (compras, estornos e pagamentos), do mais antigo ao mais
 * recente, incluindo parcelas futuras. A divisão em faturas é feita por `summarizeBills`.
 */
export function listCardMovements(db: SQLiteDatabase, cardId: number) {
  return db.getAllAsync<CardMovement>(
    `SELECT date, kind, amount, account_id, to_account_id FROM transactions
       WHERE account_id = $card OR to_account_id = $card
     ORDER BY date`,
    { $card: cardId }
  );
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

// ─── Orçamento ─────────────────────────────────────────────────────────────

/**
 * Define o limite mensal da categoria a partir de `month` ("2026-11").
 * Use 0 para "sem limite". Meses anteriores mantêm o limite que tinham.
 */
export async function setBudget(db: SQLiteDatabase, categoryId: number, amount: number, month: string) {
  await db.runAsync(
    `INSERT INTO budgets (category_id, amount, valid_from) VALUES (?, ?, ?)
     ON CONFLICT (category_id, valid_from) DO UPDATE SET amount = excluded.amount`,
    categoryId,
    amount,
    month
  );
  notifyDataChanged();
}

/** Limite que vale para a categoria no mês (0 = sem limite). */
export async function getBudget(db: SQLiteDatabase, categoryId: number, month: string) {
  const row = await db.getFirstAsync<{ amount: number }>(
    `SELECT amount FROM budgets
     WHERE category_id = ? AND valid_from <= ?
     ORDER BY valid_from DESC LIMIT 1`,
    categoryId,
    month
  );
  return row?.amount ?? 0;
}

/** Limite e gasto do mês de cada categoria principal de despesa. */
export function budgetProgress(db: SQLiteDatabase, month: string) {
  return db.getAllAsync<BudgetProgress>(
    `SELECT c.id AS category_id, c.name, c.color, c.icon,
       COALESCE((
         SELECT b.amount FROM budgets b
         WHERE b.category_id = c.id AND b.valid_from <= $month
         ORDER BY b.valid_from DESC LIMIT 1
       ), 0) AS budget,
       COALESCE((
         SELECT SUM(t.amount) FROM transactions t
         LEFT JOIN categories sub ON sub.id = t.category_id
         WHERE t.kind = 'expense'
           AND t.date BETWEEN $start AND $end
           AND (t.category_id = c.id OR sub.parent_id = c.id)
       ), 0) AS spent
     FROM categories c
     WHERE c.kind = 'expense' AND c.parent_id IS NULL
     ORDER BY c.name COLLATE NOCASE`,
    { $month: month, $start: `${month}-01`, $end: `${month}-31` }
  );
}

/**
 * Registra que o aviso de `level`% foi enviado para a categoria no mês.
 * Devolve true só na primeira vez; nas seguintes o banco ignora a gravação.
 */
export async function markBudgetAlert(
  db: SQLiteDatabase,
  categoryId: number,
  month: string,
  level: 80 | 100
) {
  const result = await db.runAsync(
    'INSERT OR IGNORE INTO budget_alerts (category_id, month, level) VALUES (?, ?, ?)',
    categoryId,
    month,
    level
  );
  return result.changes > 0;
}

/** Gasto do mês por categoria, sem somar subcategorias (para mostrar o gasto de cada subcategoria). */
export function categorySpending(db: SQLiteDatabase, month: string) {
  return db.getAllAsync<{ category_id: number; spent: number }>(
    `SELECT category_id, SUM(amount) AS spent
     FROM transactions
     WHERE kind = 'expense' AND category_id IS NOT NULL
       AND date BETWEEN ? AND ?
     GROUP BY category_id`,
    `${month}-01`,
    `${month}-31`
  );
}

// ─── Recorrências ──────────────────────────────────────────────────────────

/** Recorrências ativas com ocorrência pendente até `until`. Com `auto`, só as desse modo. */
export function listDueRecurrences(db: SQLiteDatabase, until: string, auto?: boolean) {
  return db.getAllAsync<Recurrence>(
    `SELECT * FROM recurrences
     WHERE paused = 0 AND next_date <= ? ${auto === undefined ? '' : 'AND auto = ?'}
     ORDER BY next_date`,
    auto === undefined ? [until] : [until, auto ? 1 : 0]
  );
}

/** Cria o lançamento de uma ocorrência, já vinculado à recorrência. */
export async function insertRecurrenceTransaction(db: SQLiteDatabase, rec: Recurrence, date: string) {
  const isTransfer = rec.kind === 'transfer';
  await db.runAsync(
    `INSERT INTO transactions
       (kind, amount, date, description, notes, account_id, to_account_id, category_id, recurrence_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    rec.kind,
    rec.amount,
    date,
    rec.description,
    rec.notes,
    rec.account_id,
    isTransfer ? rec.to_account_id : null,
    isTransfer ? null : rec.category_id,
    rec.id
  );
}

/** Avança o "ponteiro" da recorrência para a próxima ocorrência ainda não gerada. */
export async function setRecurrenceNextDate(db: SQLiteDatabase, id: number, nextDate: string) {
  await db.runAsync('UPDATE recurrences SET next_date = ? WHERE id = ?', nextDate, id);
}

/** Todas as recorrências com nomes resolvidos: ativas primeiro, depois pela próxima data. */
export function listRecurrences(db: SQLiteDatabase) {
  return db.getAllAsync<RecurrenceRow>(
    `SELECT r.*,
       a.name AS account_name,
       ta.name AS to_account_name,
       c.name AS category_name,
       c.color AS category_color,
       c.icon AS category_icon,
       COALESCE(c.parent_id, c.id) AS budget_category_id
     FROM recurrences r
     JOIN accounts a ON a.id = r.account_id
     LEFT JOIN accounts ta ON ta.id = r.to_account_id
     LEFT JOIN categories c ON c.id = r.category_id
     ORDER BY r.paused, r.next_date`
  );
}

/** Uma recorrência pelo id, no formato de `RecurrenceRow` (os nomes vêm nulos). */
export function getRecurrence(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<RecurrenceRow>(
    `SELECT r.*, NULL AS account_name, NULL AS to_account_name, NULL AS category_name,
       NULL AS category_color, NULL AS category_icon, NULL AS budget_category_id
     FROM recurrences r WHERE r.id = ?`,
    id
  );
}

/** Cria a recorrência (sem `id`) ou atualiza a existente. Devolve o id. */
export async function saveRecurrence(db: SQLiteDatabase, input: RecurrenceInput, id?: number) {
  const isTransfer = input.kind === 'transfer';
  const values = [
    input.kind,
    input.amount,
    input.description.trim(),
    input.notes.trim(),
    input.account_id,
    isTransfer ? input.to_account_id : null,
    isTransfer ? null : input.category_id,
    input.frequency,
    input.anchor_date,
    input.next_date,
    input.auto,
    input.paused,
    input.business_days,
    input.business_day_n,
    input.notify,
  ];
  if (id) {
    await db.runAsync(
      `UPDATE recurrences SET kind = ?, amount = ?, description = ?, notes = ?, account_id = ?,
         to_account_id = ?, category_id = ?, frequency = ?, anchor_date = ?, next_date = ?, auto = ?,
         paused = ?, business_days = ?, business_day_n = ?, notify = ?
       WHERE id = ?`,
      ...values,
      id
    );
  } else {
    const result = await db.runAsync(
      `INSERT INTO recurrences (kind, amount, description, notes, account_id, to_account_id, category_id,
         frequency, anchor_date, next_date, auto, paused, business_days, business_day_n, notify)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ...values
    );
    id = result.lastInsertRowId;
  }
  notifyDataChanged();
  return id;
}

/** Apaga a regra. Os lançamentos já gerados continuam, só sem o vínculo. */
export async function deleteRecurrence(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM recurrences WHERE id = ?', id);
  notifyDataChanged();
}