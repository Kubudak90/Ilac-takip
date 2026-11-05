// Uyum (adherence) hesapları: planlı dozların türetilmesi ve istatistik.
//
// Model: yalnızca DOZ SAATİ (doseTimes) tanımlı ve o gün aktif takvimi olan
// ilaçlar günlük dozlara açılır; her ilaç için bir saat-yuvası = bir planlı doz.
// Bir dozun durumu doz günlüğündeki (DoseEvent) kayda göre belirlenir; kayıt
// yoksa geçmiş gün "kaçırıldı" (missed), bugün/gelecek "bekliyor" (pending) sayılır.

import { DoseEvent, MealRelation, Medication } from '../types';
import {
  addDays,
  dayKeyToDate,
  daysBetween,
  formatDose,
  parseISO,
  roundUnits,
  startOfDay,
  toDayKey,
} from './date';

export type DoseStatus = 'taken' | 'skipped' | 'pending' | 'missed';

export interface ScheduledDose {
  med: Medication;
  /** Planlı saat "HH:MM". */
  time: string;
  /** Bu yuva için doz miktarı (dailyDose / saat sayısı). */
  doseSize: number;
  /** `${medId}|${dayKey}|${time}` */
  key: string;
  status: DoseStatus;
}

/** Date.getDay() indeksine göre (0=Pazar .. 6=Cumartesi) Türkçe kısa gün adları. */
export const WEEKDAY_SHORT_TR: readonly string[] = [
  'Paz',
  'Pzt',
  'Sal',
  'Çar',
  'Per',
  'Cum',
  'Cmt',
];

/** UI gösterimi için Pazartesi'den Pazar'a sıralı gün indeksleri. */
export const WEEKDAY_DISPLAY_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

const MEAL_LABELS: Record<MealRelation, string> = {
  none: '',
  before_meal: 'Aç karnına',
  after_meal: 'Tok karnına',
  with_meal: 'Yemekle birlikte',
};

/** Yemek durumu etiketini Türkçe döndürür (yoksa veya 'none' ise null). */
export function mealRelationLabel(meal?: MealRelation): string | null {
  if (!meal || meal === 'none') return null;
  return MEAL_LABELS[meal] || null;
}

/** İlacın kullanım sıklığını özetleyen Türkçe etiket. */
export function scheduleSummaryLabel(med: Medication): string {
  const type = med.scheduleType ?? 'daily';
  const doseStr = `${formatDose(med.dailyDose)} adet`;
  if (type === 'prn') {
    return `İhtiyaç halinde (${doseStr})`;
  }
  if (type === 'weekdays') {
    const days =
      med.weekdays && med.weekdays.length > 0
        ? WEEKDAY_DISPLAY_ORDER.filter((d) => med.weekdays!.includes(d)).map(
            (d) => WEEKDAY_SHORT_TR[d],
          )
        : [];
    if (days.length > 0 && days.length < 7) {
      return `${days.join(', ')} · ${doseStr}`;
    }
    return `Günde ${doseStr}`;
  }
  if (type === 'interval') {
    const n = med.intervalDays && med.intervalDays >= 2 ? Math.floor(med.intervalDays) : 2;
    const prefix = n === 2 ? 'Gün aşırı' : `${n} günde bir`;
    return `${prefix} · ${doseStr}`;
  }
  return `Günde ${doseStr}`;
}

/** Doz günlüğü anahtarı (DoseEvent.id ile aynı). */
export function doseKey(medId: string, dayKey: string, time: string): string {
  return `${medId}|${dayKey}|${time}`;
}

/** İlacın benzersiz ve sıralı doz saatleri (yedekten gelen tekrarları eler). */
export function uniqueDoseTimes(med: Medication): string[] {
  if (!med.doseTimes || med.doseTimes.length === 0) return [];
  return Array.from(new Set(med.doseTimes)).sort();
}

/** İlacın oluşturulduğu yerel gün anahtarı ("YYYY-MM-DD"). */
export function createdDayKey(med: Medication): string {
  return toDayKey(parseISO(med.createdAt));
}

/**
 * Bir ilacın belirli bir yerel günde ("YYYY-MM-DD") planlı alımı olup olmadığını
 * belirler.
 * - Oluşturulma gününden önce: false
 * - 'prn' (ihtiyaç halinde): false (sabit günlük takvimi yok, kaçırıldı sayılmaz)
 * - 'weekdays': haftanın seçili günlerinde true
 * - 'interval': başlangıç gününden itibaren her N günde bir true
 * - 'daily' (varsayılan): true
 */
export function isMedicationActiveOnDay(med: Medication, dayKey: string): boolean {
  const createdKey = createdDayKey(med);
  if (dayKey < createdKey) return false;

  const type = med.scheduleType ?? 'daily';
  if (type === 'prn') return false;

  if (type === 'weekdays') {
    if (!med.weekdays || med.weekdays.length === 0) return true;
    const dow = dayKeyToDate(dayKey).getDay();
    return med.weekdays.includes(dow);
  }

  if (type === 'interval') {
    const n =
      med.intervalDays && med.intervalDays >= 2 ? Math.floor(med.intervalDays) : 2;
    const anchorKey = med.intervalStartDate
      ? toDayKey(parseISO(med.intervalStartDate))
      : createdKey;
    const diff = daysBetween(dayKeyToDate(anchorKey), dayKeyToDate(dayKey));
    return diff >= 0 && diff % n === 0;
  }

  return true;
}

/** Bir saat-yuvası için doz miktarı: günlük toplam / (benzersiz) saat sayısı. */
export function doseSizeFor(med: Medication): number {
  const n = uniqueDoseTimes(med).length || 1;
  return roundUnits(med.dailyDose / n);
}

/** Doz günlüğünü hızlı arama için Map'e çevirir (anahtar = DoseEvent.id). */
export function indexLog(doseLog: DoseEvent[]): Map<string, DoseEvent> {
  return new Map(doseLog.map((e) => [e.id, e]));
}

/**
 * Belirli bir gün için planlı dozları üretir (yalnızca doseTimes olan ve o gün
 * takvimde aktif olan ilaçlar). Saate göre sıralı döner.
 */
export function scheduledDosesForDate(
  meds: Medication[],
  logByKey: Map<string, DoseEvent>,
  dayKey: string,
  todayK: string,
): ScheduledDose[] {
  const out: ScheduledDose[] = [];
  for (const med of meds) {
    const times = uniqueDoseTimes(med);
    if (times.length === 0) continue;
    // İlaç o günden önce henüz yoktu ya da o gün takvimde aktif değil:
    if (!isMedicationActiveOnDay(med, dayKey)) continue;
    const size = doseSizeFor(med);
    for (const time of times) {
      const key = doseKey(med.id, dayKey, time);
      const ev = logByKey.get(key);
      const status: DoseStatus = ev
        ? ev.status
        : dayKey < todayK
          ? 'missed'
          : 'pending';
      out.push({ med, time, doseSize: size, key, status });
    }
  }
  out.sort((a, b) => {
    if (a.time === b.time) return a.med.name.localeCompare(b.med.name, 'tr');
    return a.time.localeCompare(b.time);
  });
  return out;
}

export interface AdherenceSummary {
  taken: number;
  skipped: number;
  /** Geçmiş ama işaretlenmemiş (alınmamış sayılan) dozlar. */
  missed: number;
  /** Değerlendirmeye giren toplam (taken+skipped+missed; bugünkü bekleyenler hariç). */
  total: number;
  /** Uyum oranı 0..1 (taken/total); total=0 ise 0. */
  rate: number;
}

const EMPTY_SUMMARY: AdherenceSummary = {
  taken: 0,
  skipped: 0,
  missed: 0,
  total: 0,
  rate: 0,
};

/**
 * Verilen gün anahtarları için uyum özeti. Bir ilaç, oluşturulduğu günden
 * önceki günlerde ve takviminde aktif olmadığı günlerde sayılmaz. Bugünün
 * işaretlenmemiş dozları "missed" sayılmaz (henüz bekliyor).
 */
export function adherenceSummary(
  meds: Medication[],
  logByKey: Map<string, DoseEvent>,
  dayKeys: string[],
  todayK: string,
): AdherenceSummary {
  let taken = 0;
  let skipped = 0;
  let missed = 0;
  for (const med of meds) {
    const times = uniqueDoseTimes(med);
    if (times.length === 0) continue;
    for (const dayKey of dayKeys) {
      if (dayKey > todayK) continue;
      if (!isMedicationActiveOnDay(med, dayKey)) continue;
      for (const time of times) {
        const ev = logByKey.get(doseKey(med.id, dayKey, time));
        if (ev?.status === 'taken') taken++;
        else if (ev?.status === 'skipped') skipped++;
        else if (dayKey < todayK) missed++; // geçmiş ve işaretlenmemiş
        // bugün işaretlenmemiş => bekliyor, sayılmaz
      }
    }
  }
  const total = taken + skipped + missed;
  if (total === 0) return EMPTY_SUMMARY;
  return { taken, skipped, missed, total, rate: taken / total };
}

/** Bir günün özet durumu (takvim hücresi rengi için). */
export type DayLevel = 'none' | 'allTaken' | 'someSkipped' | 'anyMissed' | 'future';

/** Bir gündeki dozların en kötü durumunu özetler. */
export function dayLevel(doses: ScheduledDose[]): DayLevel {
  if (doses.length === 0) return 'none';
  let anyMissed = false;
  let anySkipped = false;
  let anyPending = false;
  let anyTaken = false;
  for (const d of doses) {
    if (d.status === 'missed') anyMissed = true;
    else if (d.status === 'skipped') anySkipped = true;
    else if (d.status === 'pending') anyPending = true;
    else if (d.status === 'taken') anyTaken = true;
  }
  if (anyMissed) return 'anyMissed';
  if (anySkipped) return 'someSkipped';
  if (anyPending) return 'future'; // henüz tamamlanmamış (bugün/gelecek)
  if (anyTaken) return 'allTaken';
  return 'none';
}

/** Son n günün gün anahtarları (bugün dahil), ESKİDEN YENİYE sıralı. */
export function lastNDayKeys(n: number): string[] {
  const base = startOfDay(new Date());
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(toDayKey(addDays(base, -i)));
  }
  return keys;
}

