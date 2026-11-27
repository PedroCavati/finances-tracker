import type { SymbolViewProps } from 'expo-symbols';

/** Ícones disponíveis para categorias e contas: SF Symbol no iOS, Material Symbol no Android/web. */
export const ICONS = {
  food: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
  groceries: { ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' },
  transport: { ios: 'car', android: 'directions_car', web: 'directions_car' },
  home: { ios: 'house', android: 'home', web: 'home' },
  health: { ios: 'heart', android: 'favorite', web: 'favorite' },
  leisure: { ios: 'gamecontroller', android: 'sports_esports', web: 'sports_esports' },
  education: { ios: 'book', android: 'school', web: 'school' },
  shopping: { ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' },
  bills: { ios: 'doc.text', android: 'receipt_long', web: 'receipt_long' },
  travel: { ios: 'airplane', android: 'flight', web: 'flight' },
  pets: { ios: 'pawprint', android: 'pets', web: 'pets' },
  gift: { ios: 'gift', android: 'redeem', web: 'redeem' },
  phone: { ios: 'iphone', android: 'smartphone', web: 'smartphone' },
  salary: { ios: 'briefcase', android: 'work', web: 'work' },
  freelance: { ios: 'laptopcomputer', android: 'laptop', web: 'laptop' },
  invest: {
    ios: 'chart.line.uptrend.xyaxis',
    android: 'trending_up',
    web: 'trending_up',
  },
  bank: { ios: 'building.columns', android: 'account_balance', web: 'account_balance' },
  wallet: { ios: 'wallet.bifold', android: 'account_balance_wallet', web: 'account_balance_wallet' },
  card: { ios: 'creditcard', android: 'credit_card', web: 'credit_card' },
  piggy: { ios: 'banknote', android: 'savings', web: 'savings' },
  other: { ios: 'ellipsis.circle', android: 'more_horiz', web: 'more_horiz' },
} satisfies Record<string, SymbolViewProps['name']>;

export type IconKey = keyof typeof ICONS;

/** Ícone a partir da chave salva no banco. Chaves desconhecidas viram "other". */
export function iconFor(key: string | null | undefined): SymbolViewProps['name'] {
  return ICONS[(key ?? 'other') as IconKey] ?? ICONS.other;
}

/** Ícones oferecidos no formulário de categoria. */
export const CATEGORY_ICON_KEYS: IconKey[] = [
  'food',
  'groceries',
  'transport',
  'home',
  'health',
  'leisure',
  'education',
  'shopping',
  'bills',
  'travel',
  'pets',
  'gift',
  'phone',
  'salary',
  'freelance',
  'invest',
  'other',
];

/** Ícones oferecidos no formulário de conta. */
export const ACCOUNT_ICON_KEYS: IconKey[] = ['bank', 'wallet', 'card', 'piggy', 'invest', 'other'];

/** Cores para categorias e contas. Funcionam sobre fundo claro e escuro. */
export const SWATCHES = [
  '#E5484D',
  '#F76B15',
  '#FFC53D',
  '#46A758',
  '#12A594',
  '#0090FF',
  '#3E63DD',
  '#8E4EC6',
  '#D6409F',
  '#8D8D86',
];
