import type { DoseEvent, Medication } from '../../types';
import {
  adherenceSummary,
  dayLevel,
  doseKey,
  doseSizeFor,
  indexLog,
  lastNDayKeys,
  scheduledDosesForDate,
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
