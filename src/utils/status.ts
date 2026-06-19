// İlaç stoğu ve rapor için bitiş tarihi + aciliyet hesapları.

import { Medication } from '../types';
import { StatusLevel } from '../theme';
import { addDays, daysBetween, parseISO, roundUnits, today } from './date';

// Çok büyük stok girilirse (ör. yanlışlıkla 99999) tarih hesabının "Invalid
// Date" ya da saçma yıllar üretmesini engellemek için üst sınır (~10 yıl).
const MAX_DAYS_OF_SUPPLY = 3650;

/**
 * Stok bitiş tarihini hesaplar.
 * kalan gün = floor(stockUnits / dailyDose), referans = stockUpdatedAt.
 * dailyDose <= 0 ise hesaplanamaz (null döner).
 */
export function stockRunOutDate(med: Medication): Date | null {
  if (!med.dailyDose || med.dailyDose <= 0) return null;
  const raw = Math.floor(currentRemainingUnits(med) / med.dailyDose);
  const daysOfSupply = Math.min(Math.max(0, raw), MAX_DAYS_OF_SUPPLY);
  // Gerçek sayımdan BUGÜNDEN ileriye projeksiyon. Stok artık güncel kabul
  // edilir (doz işaretleme ile düşürülür), bu yüzden taban stockUpdatedAt değil
  // bugündür: "elindeki kadarıyla şu tarihte biter".
  return addDays(today(), daysOfSupply);
}

/** Bugünden kutu son kullanma tarihine kalan gün. Yoksa null. */
export function daysUntilExpiry(med: Medication): number | null {
  if (!med.expiryDate) return null;
  return daysBetween(today(), parseISO(med.expiryDate));
}

/** Bugünden stok bitişine kalan gün (negatif = bitti). */
export function daysUntilStockOut(med: Medication): number | null {
  const d = stockRunOutDate(med);
  if (!d) return null;
  return daysBetween(today(), d);
}

/**
 * Elde kalan adet. Stok artık GERÇEK sayımdır: tarih-bazlı tahmini azalma
 * YAPILMAZ; değer yalnızca doz işaretleme ("Aldım"), yenileme veya düzenleme
 * ile değişir. Böylece "X gün kaldı" sahte kesinlik vermez.
 */
export function currentRemainingUnits(med: Medication): number {
  return roundUnits(Math.max(0, med.stockUnits));
}

/** Stoğun en son elle güncellendiğinden (sayım/yenileme) bu yana geçen gün. */
export function stockCountAgeDays(med: Medication): number {
  return Math.max(0, daysBetween(parseISO(med.stockUpdatedAt), today()));
}

/** Bugünden rapor bitişine kalan gün. Rapor yoksa null. */
export function daysUntilReportEnd(med: Medication): number | null {
  if (!med.hasReport || !med.reportEndDate) return null;
  return daysBetween(today(), parseISO(med.reportEndDate));
}

/**
 * Kalan güne ve uyarı eşiğine göre aciliyet seviyesi.
 *   < 0 veya 0-3 gün  -> danger
 *   <= warnDays       -> warning
 *   <= 2*warnDays     -> caution
 *   aksi              -> ok
 */
export function levelForDays(days: number | null, warnDays: number): StatusLevel {
  if (days === null) return 'ok';
  if (days <= 3) return 'danger';
  if (days <= warnDays) return 'warning';
  if (days <= warnDays * 2) return 'caution';
  return 'ok';
}

export interface UrgencyItem {
  medication: Medication;
  /** 'stock' = ilaç bitiyor, 'report' = rapor bitiyor, 'expiry' = kutu son kullanma */
  kind: 'stock' | 'report' | 'expiry';
  date: Date;
  daysLeft: number;
  level: StatusLevel;
}

/** Bir ilacın tüm aciliyet satırları: stok, rapor ve (varsa) kutu son kullanma. */
export function itemsForMedication(
  med: Medication,
  warnDays: number,
): UrgencyItem[] {
  const items: UrgencyItem[] = [];

  const stockOut = stockRunOutDate(med);
  const stockDays = daysUntilStockOut(med);
  if (stockOut && stockDays !== null) {
    items.push({
      medication: med,
      kind: 'stock',
      date: stockOut,
      daysLeft: stockDays,
      level: levelForDays(stockDays, warnDays),
    });
  }

  const reportDays = daysUntilReportEnd(med);
  if (med.hasReport && med.reportEndDate && reportDays !== null) {
    items.push({
      medication: med,
      kind: 'report',
      date: parseISO(med.reportEndDate),
      daysLeft: reportDays,
      level: levelForDays(reportDays, warnDays),
    });
  }

  // Son kullanma sadece YAKIN olduğunda (≤60 gün) ya da geçtiğinde aciliyet
  // listesine girer; uzaktaki tarih kartta zaten görünür, panoyu doldurmaz.
  const expiryDays = daysUntilExpiry(med);
  if (med.expiryDate && expiryDays !== null && expiryDays <= 60) {
    // Son kullanma: geçmişse acil, 30 güne kadar uyarı, aksi halde takip.
    const level: StatusLevel =
      expiryDays < 0 ? 'danger' : expiryDays <= 30 ? 'warning' : 'caution';
    items.push({
      medication: med,
      kind: 'expiry',
      date: parseISO(med.expiryDate),
      daysLeft: expiryDays,
      level,
    });
  }

  return items;
}

/**
 * Bir ilacın en acil durumunu döndürür (stok/rapor/son kullanma).
 * Hiç hesaplanamıyorsa null.
 */
export function mostUrgentForMedication(
  med: Medication,
  warnDays: number,
): UrgencyItem | null {
  const items = itemsForMedication(med, warnDays);
  if (items.length === 0) return null;
  items.sort((a, b) => a.daysLeft - b.daysLeft);
  return items[0];
}

/**
 * Tüm ilaçlar için aciliyet listesi (stok + rapor + son kullanma ayrı
 * satırlar), en yakın bitişe göre sıralı.
 */
export function buildUrgencyList(
  meds: Medication[],
  warnDays: number,
): UrgencyItem[] {
  const items: UrgencyItem[] = [];
  for (const med of meds) {
    items.push(...itemsForMedication(med, warnDays));
  }
  items.sort((a, b) => a.daysLeft - b.daysLeft);
  return items;
}

const LEVEL_ORDER: Record<StatusLevel, number> = {
  danger: 0,
  warning: 1,
  caution: 2,
  ok: 3,
};

/** Bir hasta için en kötü (en acil) seviyeyi döndürür. */
export function worstLevelForMeds(
  meds: Medication[],
  warnDays: number,
): StatusLevel {
  let worst: StatusLevel = 'ok';
  for (const med of meds) {
    const u = mostUrgentForMedication(med, warnDays);
    if (u && LEVEL_ORDER[u.level] < LEVEL_ORDER[worst]) {
      worst = u.level;
    }
  }
  return worst;
}
