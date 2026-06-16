// Renkler ve ortak stil sabitleri. Yaşlı/bakıcı kullanımı için
// yüksek kontrast ve büyük dokunma alanları hedeflenir.

export const colors = {
  primary: '#0F766E', // teal
  primaryDark: '#115E59',
  primaryLight: '#CCFBF1',

  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',

  text: '#0F172A',
  textMuted: '#64748B',
  textLight: '#94A3B8',

  // Durum renkleri (aciliyet) — açık zeminlerde okunaklı kontrast için koyu tonlar
  danger: '#DC2626', // bitti / 0-3 gün
  warning: '#C2410C', // yakında / warnDays içinde
  caution: '#92400E', // 2 kat warnDays içinde (pale sarı üzerinde okunaklı)
  ok: '#15803D', // bol zaman var

  dangerBg: '#FEE2E2',
  warningBg: '#FFEDD5',
  cautionBg: '#FEF9C3',
  okBg: '#DCFCE7',

  white: '#FFFFFF',
};

export type StatusLevel = 'danger' | 'warning' | 'caution' | 'ok';

export const statusColor: Record<StatusLevel, string> = {
  danger: colors.danger,
  warning: colors.warning,
  caution: colors.caution,
  ok: colors.ok,
};

export const statusBg: Record<StatusLevel, string> = {
  danger: colors.dangerBg,
  warning: colors.warningBg,
  caution: colors.cautionBg,
  ok: colors.okBg,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const fontSize = {
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
};
