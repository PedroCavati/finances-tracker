/** Datas são guardadas como texto "YYYY-MM-DD", no fuso local. */

// ─── Conversão ─────────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Date → "2026-11-26", no fuso local. */
export function toISODate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-11-26" → Date à meia-noite local, sem conversão de fuso. */
export function parseISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Data de hoje no formato "2026-11-26". */
export function today() {
  return toISODate(new Date());
}

/** "2026-11-26" → "2026-11" (mês usado no orçamento). */
export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

// ─── Cálculo ──────────────────────────────────────────────────────────────────

/** Soma (ou subtrai, com número negativo) dias a uma data. */
export function addDays(iso: string, days: number) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Primeiro e último dia do mês, deslocado `offset` meses a partir do mês de `iso`. */
export function monthRange(iso: string, offset = 0) {
  const base = parseISODate(iso);
  const start = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const end = new Date(base.getFullYear(), base.getMonth() + offset + 1, 0);
  return { start: toISODate(start), end: toISODate(end) };
}

// ─── Texto ────────────────────────────────────────────────────────────────────

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "Novembro de 2026" */
export function formatMonth(iso: string) {
  const date = parseISODate(iso);
  const text = `${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * "Hoje", "Ontem" ou "qua, 25 de novembro" (com o ano só se não for o atual).
 * Com `short`, para espaços curtos: "qua, 25 nov".
 */
export function formatDayLabel(iso: string, { short = false }: { short?: boolean } = {}) {
  const now = today();
  if (iso === now) return 'Hoje';
  if (iso === addDays(now, -1)) return 'Ontem';
  if (iso === addDays(now, 1)) return 'Amanhã';
  const date = parseISODate(iso);
  const weekday = WEEKDAYS[date.getDay()];
  const year = date.getFullYear() === new Date().getFullYear() ? '' : ` ${date.getFullYear()}`;
  return short
    ? `${weekday}, ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}${year}`
    : `${weekday}, ${date.getDate()} de ${MONTHS[date.getMonth()]}${year ? ` de${year}` : ''}`;
}

/** "dez/26": mês e ano curtos, para listas de parcelas. */
export function formatMonthShort(iso: string) {
  const date = parseISODate(iso);
  return `${MONTHS_SHORT[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`;
}

/** "25/11/2026" */
export function formatShortDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Soma meses mantendo o dia, ou usando o último dia do mês quando ele não existe:
 * 31/01 + 1 mês = 28/02 (ou 29/02 em ano bissexto).
 */
export function addMonthsClamped(iso: string, months: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return toISODate(target);
}