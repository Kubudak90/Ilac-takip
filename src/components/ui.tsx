// Tekrar kullanılan modern UI bileşenleri (büyük dokunma alanları, yüksek kontrast, zarif derinlik).

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  colors,
  fontSize,
  radius,
  spacing,
  StatusLevel,
  statusBg,
  statusColor,
} from '../theme';

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const content = (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

export function AvatarBadge({
  name,
  size = 48,
  bg,
  color,
}: {
  name: string;
  size?: number;
  bg?: string;
  color?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase('tr') ?? '')
    .join('');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg ?? colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: color ?? colors.primaryDark,
          fontSize: size * 0.38,
          fontWeight: '800',
        }}
      >
        {initials || 'H'}
      </Text>
    </View>
  );
}

export function ProgressBar({
  progress,
  color,
  trackColor,
  height = 10,
}: {
  /** 0..1 arası oran */
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: trackColor ?? colors.border,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${Math.round(clamped * 100)}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color ?? colors.primary,
        }}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  style,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : colors.card;
  const fg = variant === 'secondary' ? colors.primary : colors.white;
  const border = variant === 'secondary' ? colors.primary : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border },
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={20} color={fg} style={{ marginRight: 8 }} />
      ) : null}
      <Text style={[styles.buttonText, { color: fg, fontSize: fontSize.lg }]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function StatusBadge({
  level,
  label,
}: {
  level: StatusLevel;
  label: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: statusBg[level] }]}>
      <View style={[styles.dot, { backgroundColor: statusColor[level] }]} />
      <Text
        style={[
          styles.badgeText,
          { color: statusColor[level], fontSize: fontSize.sm },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function Pill({
  text,
  color,
  bg,
  icon,
}: {
  text: string;
  color?: string;
  bg?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const resolvedColor = color ?? colors.textMuted;
  const resolvedBg = bg ?? colors.bg;
  return (
    <View style={[styles.pill, { backgroundColor: resolvedBg }]}>
      {icon ? (
        <Ionicons
          name={icon}
          size={13}
          color={resolvedColor}
          style={{ marginRight: 4 }}
        />
      ) : null}
      <Text
        style={[
          styles.pillText,
          { color: resolvedColor, fontSize: fontSize.sm },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

export function Section({
  title,
  children,
  style,
}: {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ marginBottom: spacing.lg }, style]}>
      {title ? (
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, fontSize: fontSize.lg },
          ]}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.empty}>
      <View
        style={[
          styles.emptyIconCircle,
          { backgroundColor: colors.primaryLight },
        ]}
      >
        <Ionicons name={icon} size={36} color={colors.primaryDark} />
      </View>
      <Text
        style={[
          styles.emptyTitle,
          { color: colors.text, fontSize: fontSize.lg },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.emptySub,
            { color: colors.textMuted, fontSize: fontSize.md },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={[styles.loading, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function Label({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return (
    <Text
      style={[
        styles.label,
        { color: colors.text, fontSize: fontSize.md },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Arama çubuğu: hızlı temizleme düğmeli, yaşlı/bakıcı dostu geniş alan. */
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Ara…',
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <View
      style={[
        styles.searchWrap,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Ionicons
        name="search-outline"
        size={20}
        color={colors.primary}
        style={{ marginRight: spacing.sm }}
      />
      <TextInput
        style={[
          styles.searchInput,
          { color: colors.text, fontSize: fontSize.md },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        autoCorrect={false}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Aramayı temizle"
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.995 }] },
  button: {
    minHeight: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 1,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontSize: fontSize.lg, fontWeight: '800' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    gap: 6,
  },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  badgeText: { fontSize: fontSize.sm, fontWeight: '800' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
  },
  pillText: { fontSize: fontSize.sm, fontWeight: '700' },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  emptySub: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: 22,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    minHeight: 50,
    marginBottom: spacing.md,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
});


