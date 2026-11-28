/** Formatador de reais. Os valores do app são centavos inteiros; divida por 100 antes. */
const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata centavos como "R$ 1.234,56" (negativos com sinal de menos: "−R$ 755,10"). */
export function formatMoney(cents: number) {
  if (cents < 0) return `−${formatter.format(-cents / 100)}`;
  return formatter.format(cents / 100);
}

/** Igual a formatMoney, mas com sinal explícito: "+R$ 10,00" / "−R$ 10,00". */
export function formatSignedMoney(cents: number) {
  if (cents === 0) return formatMoney(0);
  return `${cents > 0 ? '+' : '−'}${formatMoney(Math.abs(cents))}`;
}

/**
 * Valor digitado → centavos. Aceita "33,50", "33.50", "1.200" e "R$ 1.200,5".
 * Vírgula ou ponto seguido de 1 ou 2 dígitos no fim é a parte dos centavos; os outros
 * pontos são separador de milhar. Devolve null se não houver nenhum número.
 */
export function parseMoneyInput(text: string) {
  const clean = text.replace(/[^\d,.]/g, '');
  const decimals = clean.match(/[.,](\d{1,2})$/);
  const integer = (decimals ? clean.slice(0, -decimals[0].length) : clean).replace(/\D/g, '');
  if (!integer && !decimals) return null;
  return Number(integer || '0') * 100 + Number((decimals?.[1] ?? '0').padEnd(2, '0'));
}

/** Centavos → texto para editar: 3350 → "33,50". */
export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',');
}