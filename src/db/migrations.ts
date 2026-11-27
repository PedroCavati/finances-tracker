import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Cada item é uma migração. Para mudar o schema, adicione um item novo ao fim —
 * nunca edite um já publicado. A versão atual fica em PRAGMA user_version.
 */
const MIGRATIONS: ((db: SQLiteDatabase) => Promise<void>)[] = [
  async (db) => {
    await db.execAsync(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        initial_balance INTEGER NOT NULL DEFAULT 0,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE
      );

      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK (kind IN ('income', 'expense', 'transfer')),
        amount INTEGER NOT NULL CHECK (amount > 0),
        date TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        to_account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_transactions_date ON transactions(date);
      CREATE INDEX idx_transactions_account ON transactions(account_id);
      CREATE INDEX idx_transactions_category ON transactions(category_id);
    `);

    await db.runAsync(
      `INSERT INTO accounts (name, type, initial_balance, color, icon) VALUES (?, ?, 0, ?, ?)`,
      'Carteira',
      'cash',
      '#46A758',
      'wallet'
    );

    const expense: [string, string, string][] = [
      ['Alimentação', '#F76B15', 'food'],
      ['Mercado', '#46A758', 'groceries'],
      ['Transporte', '#0090FF', 'transport'],
      ['Moradia', '#3E63DD', 'home'],
      ['Saúde', '#E5484D', 'health'],
      ['Lazer', '#8E4EC6', 'leisure'],
      ['Educação', '#12A594', 'education'],
      ['Compras', '#D6409F', 'shopping'],
      ['Contas', '#FFC53D', 'bills'],
      ['Outros', '#8D8D86', 'other'],
    ];
    const income: [string, string, string][] = [
      ['Salário', '#46A758', 'salary'],
      ['Freelance', '#0090FF', 'freelance'],
      ['Investimentos', '#12A594', 'invest'],
      ['Outros', '#8D8D86', 'other'],
    ];
    for (const [name, color, icon] of expense) {
      await db.runAsync(
        `INSERT INTO categories (name, kind, color, icon) VALUES (?, 'expense', ?, ?)`,
        name,
        color,
        icon
      );
    }
    for (const [name, color, icon] of income) {
      await db.runAsync(
        `INSERT INTO categories (name, kind, color, icon) VALUES (?, 'income', ?, ?)`,
        name,
        color,
        icon
      );
    }
  },

  // V2: orçamento mensal por categoria
  async (db) => {
    await db.execAsync(`
      CREATE TABLE budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL CHECK (amount >= 0),
        valid_from TEXT NOT NULL,
        UNIQUE (category_id, valid_from)
      );

      CREATE TABLE budget_alerts (
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        level INTEGER NOT NULL CHECK (level IN (80, 100)),
        PRIMARY KEY (category_id, month, level)
      );
    `);
  },

  // 3: lançamentos recorrentes
  async (db) => {
    await db.execAsync(`
      CREATE TABLE recurrences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK (kind IN ('income', 'expense', 'transfer')),
        amount INTEGER NOT NULL CHECK (amount > 0),
        description TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        to_account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
        anchor_date TEXT NOT NULL,
        next_date TEXT NOT NULL,
        auto INTEGER NOT NULL DEFAULT 1 CHECK (auto IN (0, 1)),
        paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_recurrences_next ON recurrences(next_date);

      ALTER TABLE transactions
        ADD COLUMN recurrence_id INTEGER REFERENCES recurrences(id) ON DELETE SET NULL;
    `);
  },

  // 4: dias úteis nas recorrências e aviso por notificação
  async (db) => {
    await db.execAsync(`
      ALTER TABLE recurrences ADD COLUMN business_days TEXT NOT NULL DEFAULT 'none'
        CHECK (business_days IN ('none', 'next', 'previous'));
      ALTER TABLE recurrences ADD COLUMN business_day_n INTEGER
        CHECK (business_day_n BETWEEN 1 AND 23);
      ALTER TABLE recurrences ADD COLUMN notify INTEGER NOT NULL DEFAULT 0
        CHECK (notify IN (0, 1));
    `);
  },
];


/** Roda as migrações pendentes. É chamado pelo SQLiteProvider antes de qualquer tela abrir. */
export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < MIGRATIONS.length) {
    const step = MIGRATIONS[version];
    await db.withExclusiveTransactionAsync(async (tx) => {
      await step(tx);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
