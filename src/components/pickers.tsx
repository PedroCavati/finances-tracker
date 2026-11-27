import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui';
import { iconFor, SWATCHES } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, formatDayLabel, formatShortDate, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

/** Campo de valor: cada dígito entra pela direita (R$ 0,01 → R$ 0,12 → R$ 1,23) e apagar remove o último. */
export function AmountInput({
  value,
  onChange,
  color,
  autoFocus,
}: {
  value: number;
  onChange: (cents: number) => void;
  color?: string;
  autoFocus?: boolean;
}) {
  const theme = useTheme();

  return (
    <View>
      <Text style={[styles.amount, { color: color ?? theme.text }]}>{formatMoney(value)}</Text>
      {/* Invisível e sempre vazio: só abre o teclado e recebe as teclas. */}
      <TextInput
        accessibilityLabel={`Valor, ${formatMoney(value)}`}
        value=""
        onKeyPress={({ nativeEvent: { key } }) => {
          if (key === 'Backspace') onChange(Math.floor(value / 10));
          else if (/^\d$/.test(key) && value < 1e11) onChange(value * 10 + Number(key));
        }}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        caretHidden
        contextMenuHidden
        style={styles.amountHiddenInput}
      />
    </View>
  );
}

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

/** Escolha de data sem calendário nativo: atalhos Hoje/Ontem e setas de um dia. */
export function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const theme = useTheme();
  const now = today();
  const yesterday = addDays(now, -1);
  return (
    <View style={styles.dateRow}>
      <Pressable
        accessibilityLabel="Dia anterior"
        hitSlop={8}
        onPress={() => onChange(addDays(value, -1))}
        style={[styles.dateArrow, { backgroundColor: theme.backgroundElement }]}>
        <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={16} tintColor={theme.text} />
      </Pressable>
      <View style={styles.dateLabel}>
        <ThemedText type="smallBold">{formatDayLabel(value)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatShortDate(value)}
        </ThemedText>
      </View>
      <Pressable
        accessibilityLabel="Próximo dia"
        hitSlop={8}
        onPress={() => onChange(addDays(value, 1))}
        style={[styles.dateArrow, { backgroundColor: theme.backgroundElement }]}>
        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.text} />
      </Pressable>
      <View style={styles.dateShortcuts}>
        <Chip label="Hoje" selected={value === now} onPress={() => onChange(now)} />
        <Chip label="Ontem" selected={value === yesterday} onPress={() => onChange(yesterday)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  dateArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabel: {
    minWidth: 120,
    alignItems: 'center',
  },
  dateShortcuts: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginLeft: 'auto',
  },
});
