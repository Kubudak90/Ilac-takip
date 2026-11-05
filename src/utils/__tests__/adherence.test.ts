import type { DoseEvent, Medication } from '../../types';
import {
  adherenceSummary,
  dayLevel,
  doseKey,
  doseSizeFor,
  indexLog,
  isMedicationActiveOnDay,
  lastNDayKeys,
  mealRelationLabel,
  scheduledDosesForDate,
  scheduleSummaryLabel,
  uniqueDoseTimes,
} from '../adherence';
import { toDayKey, todayKey } from '../date';

const med = (o: Partial<Medication>): Medication => ({
  id: 'm',
  patientId: 'p',
  name: 'X',
  dailyDose: 1,
  stockUnits: 0,
  stockUpdatedAt: new Date().toISOString(),
  hasReport: false,
  createdAt: new Date().toISOString(),
  ...o,
});
const keyAgo = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return toDayKey(x);
};
const isoAgo = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x.toISOString();
};
const todayK = todayKey();
const evt = (medId: string, dayKey: string, time: string, status: 'taken' | 'skipped'): DoseEvent => ({
  id: doseKey(medId, dayKey, time),
  medId,
  patientId: 'p',
  dayKey,
  time,
  status,
  appliedUnits: status === 'taken' ? 1 : 0,
  loggedAt: isoAgo(0),
});

describe('doseSizeFor', () => {
  test('2 doz / 2 saat = 1', () =>
    expect(doseSizeFor(med({ dailyDose: 2, doseTimes: ['08:00', '20:00'] }))).toBe(1));
  test('1 doz / 2 saat = 0,5', () =>
    expect(doseSizeFor(med({ dailyDose: 1, doseTimes: ['08:00', '20:00'] }))).toBe(0.5));
  test('tekrarlı saat dedupe edilir', () => {
    expect(doseSizeFor(med({ dailyDose: 1, doseTimes: ['08:00', '08:00'] }))).toBe(1);
    expect(uniqueDoseTimes(med({ doseTimes: ['20:00', '08:00', '08:00'] }))).toEqual(['08:00', '20:00']);
  });
});

describe('scheduledDosesForDate', () => {
  const m = med({ doseTimes: ['09:00'], createdAt: isoAgo(5) });
  const empty = indexLog([]);
  test('createdAt öncesi gün -> doz üretilmez', () =>
    expect(scheduledDosesForDate([m], empty, keyAgo(10), todayK)).toHaveLength(0));
  test('createdAt sonrası geçmiş gün -> missed', () =>
    expect(scheduledDosesForDate([m], empty, keyAgo(3), todayK)[0].status).toBe('missed'));
  test('bugün işaretsiz -> pending', () =>
    expect(scheduledDosesForDate([m], empty, todayK, todayK)[0].status).toBe('pending'));
  test('doz saati olmayan ilaç dahil edilmez', () =>
    expect(scheduledDosesForDate([med({})], empty, todayK, todayK)).toHaveLength(0));
  test('taken kaydı yansır', () =>
    expect(
      scheduledDosesForDate([m], indexLog([evt('m', todayK, '09:00', 'taken')]), todayK, todayK)[0].status,
    ).toBe('taken'));
  test('PRN ilaçlar sabit doz çizelgesine dahil edilmez', () => {
    const prnMed = med({ scheduleType: 'prn', doseTimes: ['09:00'], createdAt: isoAgo(5) });
    expect(scheduledDosesForDate([prnMed], empty, todayK, todayK)).toHaveLength(0);
  });
});

describe('isMedicationActiveOnDay & esnek takvimler', () => {
  test('weekdays: sadece seçili günlerde aktiftir', () => {
    // 2026-05-04 Pazartesi (getDay() = 1), 2026-05-05 Salı (getDay() = 2)
    const m = med({
      scheduleType: 'weekdays',
      weekdays: [1, 3, 5],
      createdAt: '2026-05-01T00:00:00.000Z',
    });
    expect(isMedicationActiveOnDay(m, '2026-05-04')).toBe(true);
    expect(isMedicationActiveOnDay(m, '2026-05-05')).toBe(false);
    expect(isMedicationActiveOnDay(m, '2026-05-06')).toBe(true);
  });

  test('interval: gün aşırı (2 günde bir) takvim doğru çalışır', () => {
    const m = med({
      scheduleType: 'interval',
      intervalDays: 2,
      intervalStartDate: '2026-05-01T00:00:00.000Z',
      createdAt: '2026-05-01T00:00:00.000Z',
    });
    expect(isMedicationActiveOnDay(m, '2026-05-01')).toBe(true);
    expect(isMedicationActiveOnDay(m, '2026-05-02')).toBe(false);
    expect(isMedicationActiveOnDay(m, '2026-05-03')).toBe(true);
    expect(isMedicationActiveOnDay(m, '2026-05-04')).toBe(false);
  });

  test('scheduleSummaryLabel ve mealRelationLabel Türkçe etiket üretir', () => {
    expect(scheduleSummaryLabel(med({ scheduleType: 'daily' }))).toBe('Günde 1 adet');
    expect(scheduleSummaryLabel(med({ scheduleType: 'prn' }))).toBe('İhtiyaç halinde (1 adet)');
    expect(scheduleSummaryLabel(med({ scheduleType: 'interval', intervalDays: 2 }))).toBe(
      'Gün aşırı · 1 adet',
    );
    expect(scheduleSummaryLabel(med({ scheduleType: 'weekdays', weekdays: [1, 4] }))).toBe(
      'Pzt, Per · 1 adet',
    );
    expect(mealRelationLabel('before_meal')).toBe('Aç karnına');
    expect(mealRelationLabel('after_meal')).toBe('Tok karnına');
    expect(mealRelationLabel('with_meal')).toBe('Yemekle birlikte');
    expect(mealRelationLabel('none')).toBeNull();
  });
});

describe('adherenceSummary', () => {
  test('createdAt sınırı + missed; bugün pending sayılmaz', () => {
    const m = med({ doseTimes: ['09:00'], createdAt: isoAgo(5) });
    const days = [keyAgo(2), keyAgo(1), todayK];
    const s = adherenceSummary([m], indexLog([evt('m', keyAgo(2), '09:00', 'taken')]), days, todayK);
    expect([s.taken, s.missed, s.total]).toEqual([1, 1, 2]);
  });
  test('bugün yaratılan ilaç -> total 0 (sadece bugün, o da pending)', () => {
    const m = med({ doseTimes: ['09:00'], createdAt: isoAgo(0) });
    expect(adherenceSummary([m], indexLog([]), lastNDayKeys(5), todayK).total).toBe(0);
  });
});

describe('dayLevel', () => {
  const m = med({ doseTimes: ['09:00'], createdAt: isoAgo(5) });
  const empty = indexLog([]);
  test('ilaç öncesi gün -> none (kırmızı değil)', () =>
    expect(dayLevel(scheduledDosesForDate([m], empty, keyAgo(10), todayK))).toBe('none'));
  test('geçmiş işaretsiz -> anyMissed', () =>
    expect(dayLevel(scheduledDosesForDate([m], empty, keyAgo(3), todayK))).toBe('anyMissed'));
});

describe('lastNDayKeys', () => {
  test('uzunluk ve sıra (eski->yeni, bugün son)', () => {
    const k = lastNDayKeys(7);
    expect(k).toHaveLength(7);
    expect(k[6]).toBe(todayK);
    expect(k[0]).toBe(keyAgo(6));
  });
});

