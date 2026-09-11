/* eslint-disable import/first -- jest.mock native Expo modules before storage import */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async (n: number) => new Uint8Array(n).fill(1)),
}));

import { DEFAULT_SETTINGS } from '../../types';
import { parseBackup, serializeBackup, isEncryptedBackup } from '../storage';

const sample = {
  patients: [
    {
      id: 'p1',
      fullName: 'Ayşe Yılmaz',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  medications: [
    {
      id: 'm1',
      patientId: 'p1',
      name: 'Coraspin',
      dailyDose: 1,
      stockUnits: 28,
      stockUpdatedAt: '2026-01-01',
      hasReport: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  doseLog: [],
  settings: DEFAULT_SETTINGS,
  barcodeBook: {},
};

describe('parseBackup / serializeBackup', () => {
  test('yuvarlak trip: serialize -> parse', () => {
    const text = serializeBackup(sample);
    const back = parseBackup(text);
    expect(back.patients).toHaveLength(1);
    expect(back.patients[0].fullName).toBe('Ayşe Yılmaz');
    expect(back.medications).toHaveLength(1);
    expect(back.medications[0].name).toBe('Coraspin');
    // stok>0 -> trackStock migrasyonu
    expect(back.medications[0].trackStock).toBe(true);
  });

  test('düz AppData kabul edilir', () => {
    const back = parseBackup(JSON.stringify(sample));
    expect(back.patients[0].id).toBe('p1');
  });

  test('geçersiz yedek hata fırlatır', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow(/Geçerli bir İlaç Takip/);
  });

  test('sahibi olmayan ilaç düşülür', () => {
    const orphan = {
      ...sample,
      medications: [
        ...sample.medications,
        {
          id: 'orphan',
          patientId: 'yok',
          name: 'Ghost',
          dailyDose: 1,
          stockUnits: 0,
          stockUpdatedAt: '2026-01-01',
          hasReport: false,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const back = parseBackup(JSON.stringify({ app: 'ilac-takip', version: 1, data: orphan }));
    expect(back.medications.map((m) => m.id)).toEqual(['m1']);
  });

  test('isEncryptedBackup düz JSON için false', () => {
    expect(isEncryptedBackup(serializeBackup(sample))).toBe(false);
    expect(isEncryptedBackup('not-json')).toBe(false);
  });
});
