/** Datas são guardadas como texto "YYYY-MM-DD", no fuso local. */

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toISODate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today() {
  return toISODate(new Date());
}

/** "2026-11-26" → "2026-11" (mês usado no orçamento). */
export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

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

/** "Hoje", "Ontem" ou "qua, 25 de novembro" (com o ano só se não for o atual). */
export function formatDayLabel(iso: string) {
  const now = today();
  if (iso === now) return 'Hoje';
  if (iso === addDays(now, -1)) return 'Ontem';
  const date = parseISODate(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} de ${MONTHS[date.getMonth()]}${
    sameYear ? '' : ` de ${date.getFullYear()}`
  }`;
}

/** "25/11/2026" */
export function formatShortDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
