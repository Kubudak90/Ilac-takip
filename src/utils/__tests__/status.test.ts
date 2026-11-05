import type { Medication } from '../../types';
import {
  currentRemainingUnits,
  daysUntilStockOut,
  effectiveDailyDose,
  isDepleted,
  isExpired,
  levelForDays,
  stockRunOutDate,
} from '../status';
import { daysBetween, today } from '../date';

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
const isoAgo = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x.toISOString();
};

describe('stok = gerçek sayım (tahmini azalma yok)', () => {
  test('currentRemainingUnits zamanla azalmaz', () => {
    expect(currentRemainingUnits(med({ stockUnits: 10, stockUpdatedAt: isoAgo(30) }))).toBe(10);
  });

  test('stockRunOutDate bugünden ileri projeksiyon', () => {
    const m = med({
      trackStock: true,
      stockUnits: 10,
      dailyDose: 2,
      stockUpdatedAt: isoAgo(30),
    });
    expect(daysBetween(today(), stockRunOutDate(m)!)).toBe(5);
    expect(daysUntilStockOut(m)).toBe(5);
  });

  test('dailyDose<=0 -> hesaplanamaz (null)', () => {
    expect(stockRunOutDate(med({ dailyDose: 0, stockUnits: 5 }))).toBeNull();
  });

  test('gün aşırı (interval=2) stok bitiş süresini iki katına çıkarır', () => {
    const m = med({
      trackStock: true,
      stockUnits: 10,
      dailyDose: 1,
      scheduleType: 'interval',
      intervalDays: 2,
    });
    expect(effectiveDailyDose(m)).toBe(0.5);
    expect(daysUntilStockOut(m)).toBe(20);
  });

  test('haftanın belirli günleri (weekdays) stok bitişini doğru hesaplar', () => {
    const m = med({
      trackStock: true,
      stockUnits: 6,
      dailyDose: 1,
      scheduleType: 'weekdays',
      weekdays: [1, 3, 5], // haftada 3 gün
    });
    expect(effectiveDailyDose(m)).toBeCloseTo(3 / 7);
    expect(daysUntilStockOut(m)).toBe(14);
  });

  test('PRN ilaçlar için sabit stok bitiş tarihi hesaplanmaz', () => {
    const m = med({
      trackStock: true,
      stockUnits: 10,
      dailyDose: 1,
      scheduleType: 'prn',
    });
    expect(effectiveDailyDose(m)).toBe(0);
    expect(stockRunOutDate(m)).toBeNull();
  });
});

describe('isDepleted ve isExpired', () => {
  test('tracked + stok 0 -> tükendi', () =>
    expect(isDepleted(med({ trackStock: true, stockUnits: 0 }))).toBe(true));
  test('tracked + stok 5 -> değil', () =>
    expect(isDepleted(med({ trackStock: true, stockUnits: 5 }))).toBe(false));
  test('takip yok + stok 0 -> değil (salt hatırlatma)', () =>
    expect(isDepleted(med({ stockUnits: 0 }))).toBe(false));
  test('tracked + dailyDose 0 -> değil', () =>
    expect(isDepleted(med({ trackStock: true, dailyDose: 0, stockUnits: 0 }))).toBe(false));
  test('SKT geçmiş ilaç isExpired -> true, gelecekte -> false', () => {
    expect(isExpired(med({ expiryDate: isoAgo(2) }))).toBe(true);
    expect(isExpired(med({ expiryDate: isoAgo(-10) }))).toBe(false);
    expect(isExpired(med({}))).toBe(false);
  });
});

describe('levelForDays aciliyet eşikleri (warnDays=7)', () => {
  test.each([
    [2, 'danger'],
    [5, 'warning'],
    [10, 'caution'],
    [20, 'ok'],
  ])('%i gün -> %s', (d, lvl) => {
    expect(levelForDays(d as number, 7)).toBe(lvl);
  });
  test('null -> ok', () => expect(levelForDays(null, 7)).toBe('ok'));
});

