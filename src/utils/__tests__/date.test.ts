import {
  addDays,
  dayKeyToDate,
  daysBetween,
  formatDose,
  humanDays,
  roundUnits,
  startOfDay,
  toDayKey,
} from '../date';

describe('date yardımcıları', () => {
  test('toDayKey / dayKeyToDate yerel round-trip', () => {
    expect(toDayKey(new Date(2026, 5, 19))).toBe('2026-06-19');
    const back = dayKeyToDate('2026-06-19');
    expect([back.getFullYear(), back.getMonth(), back.getDate()]).toEqual([2026, 5, 19]);
  });

  test('daysBetween ve addDays', () => {
    const a = new Date(2026, 0, 1);
    expect(daysBetween(a, addDays(a, 10))).toBe(10);
    expect(daysBetween(addDays(a, 10), a)).toBe(-10);
  });

  test('humanDays', () => {
    expect(humanDays(-1)).toBe('1 gün geçti');
    expect(humanDays(-3)).toBe('3 gün geçti');
    expect(humanDays(0)).toBe('bugün bitiyor');
    expect(humanDays(1)).toBe('yarın bitiyor');
    expect(humanDays(5)).toBe('5 gün kaldı');
  });

  test('formatDose Türkçe ondalık', () => {
    expect(formatDose(0.5)).toBe('0,5');
    expect(formatDose(2)).toBe('2');
  });

  test('roundUnits kayan-nokta gürültüsünü temizler, yarımları korur', () => {
    expect(roundUnits(0.1 + 0.2)).toBe(0.3);
    expect(roundUnits(11.999999)).toBe(12);
    expect(roundUnits(27.5)).toBe(27.5);
  });

  test('startOfDay gün başına indirger', () => {
    expect(startOfDay(new Date(2026, 5, 19, 14, 30)).getHours()).toBe(0);
  });
});
