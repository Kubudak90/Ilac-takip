// İlaç stoğu ve rapor için bitiş tarihi + aciliyet hesapları.

import { Medication } from '../types';
import { StatusLevel } from '../theme';
import { addDays, daysBetween, parseISO, startOfDay, today } from './date';

/**
 * Stok bitiş tarihini hesaplar.
 * kalan gün = floor(stockUnits / dailyDose), referans = stockUpdatedAt.
 * dailyDose <= 0 ise hesaplanamaz (null döner).
 */
export function stockRunOutDate(med: Medication): Date | null {
  if (!med.dailyDose || med.dailyDose <= 0) return null;
  const daysOfSupply = Math.floor(med.stockUnits / med.dailyDose);
  const base = startOfDay(parseISO(med.stockUpdatedAt));
  return addDays(base, daysOfSupply);
}

/** Bugünden stok bitişine kalan gün (negatif = bitti). */
export function daysUntilStockOut(med: Medication): number | null {
  const d = stockRunOutDate(med);
  if (!d) return null;
  return daysBetween(today(), d);
}

/**
 * Bugün itibarıyla elde kalan tahmini adet.
 * = stockUnits - dailyDose * (stokGirildiğindenBeriGeçenGün), en az 0.
 */
export function currentRemainingUnits(med: Medication): number {
  const elapsed = daysBetween(parseISO(med.stockUpdatedAt), today());
  const used = Math.max(0, elapsed) * med.dailyDose;
  return Math.max(0, med.stockUnits - used);
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
  /** 'stock' = ilaç bitiyor, 'report' = rapor bitiyor */
  kind: 'stock' | 'report';
  date: Date;
  daysLeft: number;
  level: StatusLevel;
}

/**
 * Bir ilacın en acil durumunu döndürür (stok mu rapor mu daha yakın).
 * Hiç hesaplanamıyorsa null.
 */
export function mostUrgentForMedication(
  med: Medication,
  warnDays: number,
): UrgencyItem | null {
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

  if (items.length === 0) return null;
  items.sort((a, b) => a.daysLeft - b.daysLeft);
  return items[0];
}

/**
 * Tüm ilaçlar için aciliyet listesi (stok + rapor ayrı satırlar),
 * en yakın bitişe göre sıralı.
 */
export function buildUrgencyList(
  meds: Medication[],
  warnDays: number,
): UrgencyItem[] {
  const items: UrgencyItem[] = [];
  for (const med of meds) {
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
