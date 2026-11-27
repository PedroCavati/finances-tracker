import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { iconFor } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// ─── Cartão e título de seção ─────────────────────────────────────────────────

/** Fundo arredondado que agrupa conteúdo. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>
      {children}
    </View>
  );
}

/** Título de seção em caixa alta, com um elemento opcional à direita (ex.: "Ver todos"). */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitleText}>
        {children}
      </ThemedText>
      {right}
    </View>
  );
}

// ─── Botões ────────────────────────────────────────────────────────────────

/** Props do Pressable, mais o texto e a variante. */
type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
};

/** Botão de largura livre: principal (`primary`), secundário ou de ação destrutiva (`danger`). */
export function Button({ title, variant = 'primary', disabled, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  const background =
    variant === 'primary' ? theme.tint : variant === 'danger' ? 'transparent' : theme.backgroundElement;
  const color =
    variant === 'primary' ? theme.onTint : variant === 'danger' ? theme.expense : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
      {...rest}>
      <ThemedText style={[styles.buttonText, { color }]}>{title}</ThemedText>
    </Pressable>
  );
}

/** Botão redondo só com ícone. O `label` é o que o leitor de tela anuncia. */
export function IconButton({
  icon,
  label,
  onPress,
  filled,
}: {
  icon: SymbolViewProps['name'];
  label: string;
  onPress: () => void;
  filled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: filled ? theme.tint : theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}>
      <SymbolView name={icon} size={20} weight="semibold" tintColor={filled ? theme.onTint : theme.text} />
    </Pressable>
  );
}

/** Botão de texto para o cabeçalho dos modais (Cancelar / Salvar). */
export function HeaderButton({ title, onPress, bold }: { title: string; onPress: () => void; bold?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" hitSlop={8} onPress={onPress} style={styles.headerButton}>
      <ThemedText style={{ color: theme.tint, fontWeight: bold ? 600 : 400 }}>{title}</ThemedText>
    </Pressable>
  );
}

// ─── Chips ─────────────────────────────────────────────────────────────────

/** Pílula selecionável. Com `color`, fica dessa cor quando selecionada. */
export function Chip({
  label,
  selected,
  onPress,
  color,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: string;
}) {
  const theme = useTheme();
  const activeColor = color ?? theme.tint;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? activeColor : theme.backgroundElement,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      {icon && (
        <SymbolView
          name={iconFor(icon)}
          size={14}
          tintColor={selected ? '#ffffff' : (color ?? theme.textSecondary)}
        />
      )}
      <ThemedText
        type="small"
        style={{ color: selected ? (color ? '#ffffff' : theme.onTint) : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Controle segmentado simples (ex.: Despesa / Receita / Transferência). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: theme.background }]}>
            <ThemedText
              type="smallBold"
              style={{ color: selected ? (option.color ?? theme.text) : theme.textSecondary }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Campos ────────────────────────────────────────────────────────────────

/** Rótulo acima de um campo de formulário. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

/** Campo de texto com o visual do app. Aceita as mesmas props do TextInput. */
export function TextField(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[
        styles.input,
        { backgroundColor: theme.backgroundElement, color: theme.text },
        props.style,
      ]}
    />
  );
}

// ─── Ícone de categoria/conta ──────────────────────────────────────────────

/** Ícone num círculo com fundo translúcido da cor da categoria ou conta. */
export function Badge({ icon, color, size = 40 }: { icon: string | null; color: string | null; size?: number }) {
  const theme = useTheme();
  const tint = color ?? theme.textSecondary;
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: `${tint}26` },
      ]}>
      <SymbolView name={iconFor(icon)} size={size * 0.5} tintColor={tint} />
    </View>
  );
}

// ─── Estado vazio ──────────────────────────────────────────────────────────

/** Mensagem para listas vazias, com uma ação opcional. */
export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {message && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.emptyMessage}>
          {message}
        </ThemedText>
      )}
      {action}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Cartão e título de seção
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  sectionTitleText: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },

  // Botões
  button: {
    minHeight: 50,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  buttonText: {
    fontWeight: 600,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },

  // Chips
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },

  // Campos
  field: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 20,
  },

  // Ícone
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Estado vazio
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  emptyMessage: {
    textAlign: 'center',
  },
});
