import { addDays, parseISODate } from '@/lib/dates';

/** Feriados nacionais de data fixa (mês-dia). */
const FIXED_HOLIDAYS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Feriados já calculados, por ano. */
const cache = new Map<number, Set<string>>();

/**
 * Dias sem expediente bancário no ano: feriados nacionais, Carnaval (segunda e terça),
 * Sexta-feira Santa e Corpus Christi. Feriados estaduais e municipais não entram.
 */
function holidaysOf(year: number) {
  let set = cache.get(year);
  if (!set) {
    const easter = easterSunday(year);
    set = new Set([
      ...FIXED_HOLIDAYS.map((monthDay) => `${year}-${monthDay}`),
      addDays(easter, -48), // segunda de Carnaval
      addDays(easter, -47), // terça de Carnaval
      addDays(easter, -2), // Sexta-feira Santa
      addDays(easter, 60), // Corpus Christi
    ]);
    cache.set(year, set);
  }
  return set;
}

/** Dia útil: de segunda a sexta e fora dos feriados de `holidaysOf`. */
export function isBusinessDay(iso: string) {
  const weekday = parseISODate(iso).getDay();
  return weekday !== 0 && weekday !== 6 && !holidaysOf(Number(iso.slice(0, 4))).has(iso);
}

/** Move a data para o dia útil seguinte ou anterior, se ela não for dia útil. */
export function toBusinessDay(iso: string, direction: 'next' | 'previous') {
  let date = iso;
  while (!isBusinessDay(date)) date = addDays(date, direction === 'next' ? 1 : -1);
  return date;
}

/** N-ésimo dia útil do mês da data (ex.: 5º dia útil de dezembro de 2026 = "2026-12-07"). */
export function nthBusinessDay(iso: string, n: number) {
  let date = `${iso.slice(0, 7)}-01`;
  for (let count = 0; ; date = addDays(date, 1)) {
    if (isBusinessDay(date) && ++count === n) return date;
  }
}