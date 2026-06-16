// Tarih yardımcıları. Tüm hesaplar gün bazında, yerel saatle yapılır.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Bir tarihi gün başına (00:00) indirger. */
export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function today(): Date {
  return startOfDay(new Date());
}

/** İki tarih arasındaki tam gün farkı (b - a). Pozitif = b ileride. */
export function daysBetween(a: Date, b: Date): number {
  const diff = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(diff / MS_PER_DAY);
}

/** Bir tarihe gün ekler. */
export function addDays(d: Date, days: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
}

export function parseISO(iso: string): Date {
  return new Date(iso);
}

export function toISODate(d: Date): string {
  return startOfDay(d).toISOString();
}

const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

/** "14 Haziran 2026" biçiminde Türkçe tarih. */
export function formatTR(d: Date): string {
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTRFromISO(iso: string): string {
  return formatTR(parseISO(iso));
}

/**
 * Kalan günü insan diline çevirir.
 * Örn: -2 -> "2 gün geçti", 0 -> "bugün", 1 -> "yarın", 5 -> "5 gün kaldı"
 */
export function humanDays(days: number): string {
  if (days < 0) {
    const n = Math.abs(days);
    return n === 1 ? '1 gün geçti' : `${n} gün geçti`;
  }
  if (days === 0) return 'bugün bitiyor';
  if (days === 1) return 'yarın bitiyor';
  return `${days} gün kaldı`;
}
