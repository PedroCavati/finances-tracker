import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/ui';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { iconFor, SWATCHES } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, parseISODate, toISODate, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

// ─── Valor ────────────────────────────────────────────────────────────────────

/** Campo de valor: cada dígito entra pela direita (R$ 0,01 → R$ 0,12 → R$ 1,23) e apagar remove o último. */
export function AmountInput({
  value,
  onChange,
  color,
  autoFocus,
  onFocusChange,
}: {
  value: number;
  onChange: (cents: number) => void;
  color?: string;
  autoFocus?: boolean;
  /**
   * Avisa quando o campo ganha ou perde o foco. Use para desligar o `keyboardAware`
   * do FormScroll: cada tecla muda o texto por um instante, e a rolagem automática
   * que isso dispara faz o próximo toque na tela ser ignorado.
   */
  onFocusChange?: (focused: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <View>
      <Text style={[styles.amount, { color: color ?? theme.text }]}>{formatMoney(value)}</Text>
      {/* Invisível e sempre vazio: só abre o teclado e recebe as teclas. */}
      <TextInput
        accessibilityLabel={`Valor, ${formatMoney(value)}`}
        value=""
        onChangeText={(text) => {
          // Dígitos digitados ou colados entram pela direita, um por um.
          let next = value;
          for (const digit of text.replace(/\D/g, '')) {
            if (next < 1e11) next = next * 10 + Number(digit);
          }
          if (next !== value) onChange(next);
        }}
        onKeyPress={({ nativeEvent: { key } }) => {
          if (key === 'Backspace') onChange(Math.floor(value / 10));
        }}
        keyboardType="number-pad"
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        autoFocus={autoFocus}
        caretHidden
        contextMenuHidden
        style={styles.amountHiddenInput}
      />
    </View>
  );
}

// ─── Cor e ícone ──────────────────────────────────────────────────────────────

/** Grade com as cores de `SWATCHES` para categorias e contas. */
export function SwatchPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      {SWATCHES.map((color) => (
        <Pressable
          key={color}
          accessibilityRole="button"
          accessibilityLabel={`Cor ${color}`}
          accessibilityState={{ selected: value === color }}
          onPress={() => onChange(color)}
          style={[
            styles.swatch,
            { backgroundColor: color, borderColor: value === color ? theme.text : 'transparent' },
          ]}
        />
      ))}
    </View>
  );
}

/** Grade de ícones. O selecionado aparece na cor escolhida. */
export function IconPicker({
  icons,
  value,
  color,
  onChange,
}: {
  icons: string[];
  value: string;
  color: string;
  onChange: (icon: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      {icons.map((icon) => {
        const selected = icon === value;
        return (
          <Pressable
            key={icon}
            accessibilityRole="button"
            accessibilityLabel={`Ícone ${icon}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(icon)}
            style={[
              styles.iconCell,
              { backgroundColor: selected ? `${color}33` : theme.backgroundElement },
              selected && { borderColor: color },
            ]}>
            <SymbolView name={iconFor(icon)} size={20} tintColor={selected ? color : theme.textSecondary} />
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

/**
 * Campo de data: o seletor compacto nativo (uma pílula com a data; tocar abre o calendário)
 * e os atalhos Hoje e Ontem. Sem limite de datas: serve para o passado e para o futuro.
 */
export function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const theme = useTheme();
  const now = today();
  const yesterday = addDays(now, -1);
  return (
    <View style={styles.dateRow}>
      <DateTimePicker
        value={parseISODate(value)}
        onValueChange={(_, date) => onChange(toISODate(date))}
        display='compact'
        locale='pt_BR'
        accentColor={theme.tint}
        presentation='inline'
      />
      <View style={styles.dateShortcuts}>
        <Chip label='Hoje' selected={value === now} onPress={() => onChange(now)} />
        <Chip label="Ontem" selected={value === yesterday} onPress={() => onChange(yesterday)} />
      </View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Valor
  amount: {
    fontSize: 40,
    fontWeight: 700,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    paddingVertical: Spacing.two,
  },
  amountHiddenInput: {
    ...StyleSheet.absoluteFill,
    color: 'transparent',
  },

  // Cor e ícone
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
  },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },

  // Data
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  dateShortcuts: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginLeft: 'auto',
  },
});
