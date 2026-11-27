/**
 * Tokens visuais do app: cores (tema claro e escuro), fontes e espaçamentos.
 * Nos componentes, use as cores via `useTheme()` em vez de valores soltos.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    border: '#E0E1E6',
    tint: '#0B7A5A',
    onTint: '#ffffff',
    income: '#18794E',
    expense: '#CE2C31',
    warning: '#AB6400',
    transfer: '#0D74CE',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    border: '#2E3135',
    tint: '#3DD68C',
    onTint: '#0A1F16',
    income: '#3DD68C',
    expense: '#FF6369',
    warning: '#FFCA16',
    transfer: '#70B8FF',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** Escala de espaçamento, em pontos. Prefira estes valores a números soltos. */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Altura da barra de abas, descontada à mão no Android (no iOS o sistema já reserva o espaço). */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
/** Largura máxima do conteúdo em telas largas (tablet e web). */
export const MaxContentWidth = 800;
