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

/**
 * Bir tarihi YEREL gün anahtarına çevirir: "YYYY-MM-DD". Doz günlüğü anahtarları
 * için kullanılır; toISOString'in UTC kayması olmadan yerel günü temsil eder.
 */
export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Bugünün yerel gün anahtarı ("YYYY-MM-DD"). */
export function todayKey(): string {
  return toDayKey(new Date());
}

/** "YYYY-MM-DD" gün anahtarını yerel Date'e çevirir. */
export function dayKeyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Adet (doz) değerini kayan-nokta gürültüsünden arındırır (2 ondalık). */
export function roundUnits(n: number): number {
  return Math.round(n * 100) / 100;
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

/** Doz/adet sayısını Türkçe ondalık (virgül) ile gösterir. Ör. 0.5 -> "0,5". */
export function formatDose(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return String(n).replace('.', ',');
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
