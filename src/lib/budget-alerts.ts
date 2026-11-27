import type { SQLiteDatabase } from 'expo-sqlite';

import { budgetProgress, getCategory, markBudgetAlert } from '@/db/queries';
import { monthKey, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { notifyNow } from '@/lib/notifications';

/**
 * Depois de salvar uma despesa: se a categoria passou de 80% ou de 100% do limite
 * neste mês, avisa, uma vez por mês em cada nível.
 */
export async function checkBudgetAlert(db: SQLiteDatabase, categoryId: number | null, date: string) {
  if (categoryId === null) return;

  // Só o mês atual: lançar uma despesa antiga não deve gerar aviso.
  const month = monthKey(date);
  if (month !== monthKey(today())) return;

  // O orçamento fica na categoria principal; uma subcategoria conta para a mãe.
  const category = await getCategory(db, categoryId);
  if (!category || category.kind !== 'expense') return;
  const parentId = category.parent_id ?? category.id;

  const progress = (await budgetProgress(db, month)).find((p) => p.category_id === parentId);
  if (!progress || progress.budget === 0) return;

  const { name, spent, budget } = progress;
  const level = spent >= budget ? 100 : spent >= budget * 0.8 ? 80 : null;
  if (level === null) return;

  // Se pulou direto para 100%, o aviso de 80% não faz mais sentido depois.
  if (level === 100) await markBudgetAlert(db, parentId, month, 80);

  const isFirst = await markBudgetAlert(db, parentId, month, level);
  if (!isFirst) return;

  if (level === 100) {
    const over = spent - budget;
    await notifyNow(
      `${name}: limite atingido`,
      over > 0
        ? `Você gastou ${formatMoney(spent)} de ${formatMoney(budget)} este mês, ${formatMoney(over)} acima.`
        : `Você gastou todo o limite de ${formatMoney(budget)} deste mês.`
    );
  } else {
    await notifyNow(
      `${name}: ${Math.round((spent / budget) * 100)}% do orçamento`,
      `Você gastou ${formatMoney(spent)} de ${formatMoney(budget)} este mês. Restam ${formatMoney(budget - spent)}.`
    );
  }
}