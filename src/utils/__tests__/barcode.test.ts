import { normalizeGtin, parseGs1 } from '../barcode';

describe('normalizeGtin', () => {
  test('13 hane -> 14 (baş sıfır)', () =>
    expect(normalizeGtin('8699546012345')).toBe('08699546012345'));
  test('14 hane korunur', () =>
    expect(normalizeGtin('08699546012345')).toBe('08699546012345'));
});

describe('parseGs1', () => {
  test('düz EAN-13 -> GTIN', () => {
    expect(parseGs1('8699546012345').gtin).toBe('08699546012345');
  });

  test('parantezli GS1 (01)(17)(10)(21)', () => {
    const r = parseGs1('(01)08699546012345(17)260131(10)LOT1(21)SER1');
    expect(r.gtin).toBe('08699546012345');
    expect([r.expiry?.getFullYear(), r.expiry?.getMonth(), r.expiry?.getDate()]).toEqual([2026, 0, 31]);
    expect(r.lot).toBe('LOT1');
    expect(r.serial).toBe('SER1');
  });

  test('FNC1 ayraçlı DataMatrix', () => {
    const GS = String.fromCharCode(29);
    const r = parseGs1(`010869954601234517260131${'10LOT'}${GS}21SER`);
    expect(r.gtin).toBe('08699546012345');
    expect(r.expiry?.getMonth()).toBe(0);
  });
});

describe('parseExpiry (parseGs1 üzerinden) — geçersiz takvim günü REDDEDİLİR', () => {
  const exp = (yymmdd: string) => parseGs1(`(17)${yymmdd}`).expiry;
  test('30 Şubat -> undefined', () => expect(exp('260230')).toBeUndefined());
  test('31 Kasım -> undefined', () => expect(exp('261131')).toBeUndefined());
  test('29 Şubat 2026 (artık değil) -> undefined', () => expect(exp('260229')).toBeUndefined());
  test('29 Şubat 2024 (artık yıl) -> geçerli', () => {
    const d = exp('240229');
    expect([d?.getMonth(), d?.getDate()]).toEqual([1, 29]);
  });
  test('GG=00 -> ayın son günü (Şubat 2026 -> 28)', () => {
    const d = exp('260200');
    expect([d?.getMonth(), d?.getDate()]).toEqual([1, 28]);
  });
  test('normal gün geçerli', () => {
    const d = exp('261215');
    expect([d?.getMonth(), d?.getDate()]).toEqual([11, 15]);
  });
});
