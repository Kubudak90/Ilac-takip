// Renkler ve ortak stil sabitleri. Yaşlı/bakıcı kullanımı için
// yüksek kontrast ve büyük dokunma alanları hedeflenir.
// Karanlık mod (darkMode) ve Büyük yazı tipi (largeText) dinamik olarak desteklenir.

export const lightColors = {
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

export const darkColors: typeof lightColors = {
  primary: '#14B8A6',
  primaryDark: '#99F6E4',
  primaryLight: '#134E4A',

  bg: '#0F172A',
  card: '#1E293B',
  border: '#334155',

  text: '#F8FAFC',
  textMuted: '#CBD5E1',
  textLight: '#94A3B8',

  danger: '#FCA5A5',
  warning: '#FDBA74',
  caution: '#FDE047',
  ok: '#86EFAC',

  dangerBg: '#450A0A',
  warningBg: '#431407',
  cautionBg: '#422006',
  okBg: '#052E16',

  white: '#FFFFFF',
};

export const colors = { ...lightColors };

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

export const normalFontSize = {
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
};

export const largeFontSize: typeof normalFontSize = {
  sm: 17,
  md: 19,
  lg: 22,
  xl: 26,
  xxl: 33,
};

export const fontSize = { ...normalFontSize };

/**
 * Ayarlardaki karanlık mod ve büyük yazı tipi tercihlerini aktif tema
 * nesnelerine uygular.
 */
export function applyTheme(opts: { darkMode?: boolean; largeText?: boolean }): void {
  const palette = opts.darkMode ? darkColors : lightColors;
  Object.assign(colors, palette);
  statusColor.danger = colors.danger;
  statusColor.warning = colors.warning;
  statusColor.caution = colors.caution;
  statusColor.ok = colors.ok;
  statusBg.danger = colors.dangerBg;
  statusBg.warning = colors.warningBg;
  statusBg.caution = colors.cautionBg;
  statusBg.ok = colors.okBg;

  const fonts = opts.largeText ? largeFontSize : normalFontSize;
  Object.assign(fontSize, fonts);
}

