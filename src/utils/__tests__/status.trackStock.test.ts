import type { Medication } from '../../types';
import {
  buildUrgencyList,
  itemsForMedication,
  isDepleted,
  stockRunOutDate,
  daysUntilStockOut,
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

describe('salt-hatırlatma stok aciliyeti üretmez', () => {
  test('trackStock yok + stok 0 -> stockRunOutDate null', () => {
    expect(stockRunOutDate(med({ stockUnits: 0 }))).toBeNull();
    expect(daysUntilStockOut(med({ stockUnits: 0 }))).toBeNull();
  });

  test('trackStock yok -> urgency listesinde stock satırı yok', () => {
    const items = itemsForMedication(med({ stockUnits: 0, doseTimes: ['08:00'] }), 7);
    expect(items.filter((i) => i.kind === 'stock')).toHaveLength(0);
  });

  test('trackStock + stok > 0 -> bitiş hesaplanır', () => {
    const m = med({ trackStock: true, stockUnits: 14, dailyDose: 2 });
    expect(daysBetween(today(), stockRunOutDate(m)!)).toBe(7);
  });
});

describe('tükenen ilaç urgency listesinde stock satırı yok', () => {
  test('isDepleted + buildUrgencyList stock yok (çift planlama önleme)', () => {
    const depleted = med({ id: 'd1', trackStock: true, stockUnits: 0, dailyDose: 1 });
    expect(isDepleted(depleted)).toBe(true);
    const list = buildUrgencyList([depleted], 7);
    expect(list.filter((i) => i.kind === 'stock')).toHaveLength(0);
  });

  test('rapor satırı tükenmeden bağımsız kalır', () => {
    const depleted = med({
      id: 'd2',
      trackStock: true,
      stockUnits: 0,
      hasReport: true,
      reportEndDate: '2099-01-01',
    });
    const items = itemsForMedication(depleted, 7);
    expect(items.some((i) => i.kind === 'report')).toBe(true);
    expect(items.some((i) => i.kind === 'stock')).toBe(false);
  });
});
