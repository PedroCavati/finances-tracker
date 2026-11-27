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
