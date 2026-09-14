import { DEFAULT_SETTINGS, Medication, Patient } from '../../types';
import {
  medicationsForNotifications,
  oneshotTrigger,
  planNotifications,
  SCHEDULE_BUDGET,
} from '../notificationPlan';
import { addDays, startOfDay, today } from '../date';

const patient = (o: Partial<Patient> & Pick<Patient, 'id' | 'fullName'>): Patient => ({
  createdAt: new Date().toISOString(),
  ...o,
});

const med = (o: Partial<Medication> & Pick<Medication, 'id' | 'patientId' | 'name'>): Medication => ({
  dailyDose: 1,
  stockUnits: 10,
  stockUpdatedAt: new Date().toISOString(),
  hasReport: false,
  createdAt: new Date().toISOString(),
  trackStock: true,
  ...o,
});

describe('medicationsForNotifications (susturma)', () => {
  test('susturulmuş hastanın ilaçları elenir', () => {
    const patients = [
      patient({ id: 'p1', fullName: 'A', muteNotifications: true }),
      patient({ id: 'p2', fullName: 'B' }),
    ];
    const meds = [
      med({ id: 'm1', patientId: 'p1', name: 'X' }),
      med({ id: 'm2', patientId: 'p2', name: 'Y', doseTimes: ['08:00'] }),
    ];
    expect(medicationsForNotifications(patients, meds).map((m) => m.id)).toEqual(['m2']);
  });
});

describe('planNotifications', () => {
  test('bildirimler kapalıysa boş plan', () => {
    const r = planNotifications(
      [patient({ id: 'p1', fullName: 'A' })],
      [med({ id: 'm1', patientId: 'p1', name: 'X', doseTimes: ['08:00'] })],
      { ...DEFAULT_SETTINGS, notificationsEnabled: false },
    );
    expect(r.items).toHaveLength(0);
    expect(r.dropped).toBe(0);
  });

  test('susturulmuş hasta için doz planlanmaz', () => {
    const r = planNotifications(
      [patient({ id: 'p1', fullName: 'A', muteNotifications: true })],
      [med({ id: 'm1', patientId: 'p1', name: 'X', doseTimes: ['08:00', '20:00'] })],
      DEFAULT_SETTINGS,
    );
    expect(r.items.filter((i) => i.data.kind === 'dose')).toHaveLength(0);
  });

  test('tek hastada doz bildirimine patientId eklenir', () => {
    const r = planNotifications(
      [patient({ id: 'p1', fullName: 'Ayşe' })],
      [med({ id: 'm1', patientId: 'p1', name: 'Coraspin', doseTimes: ['08:00'] })],
      DEFAULT_SETTINGS,
    );
    const dose = r.items.find((i) => i.data.kind === 'dose');
    expect(dose?.data.patientId).toBe('p1');
  });

  test('tükenen ilaç için depleted planı, stok one-shot yok', () => {
    const r = planNotifications(
      [patient({ id: 'p1', fullName: 'A' })],
      [
        med({
          id: 'm1',
          patientId: 'p1',
          name: 'X',
          stockUnits: 0,
          trackStock: true,
          doseTimes: ['08:00'],
        }),
      ],
      DEFAULT_SETTINGS,
    );
    expect(r.items.some((i) => i.data.kind === 'depleted')).toBe(true);
    expect(r.items.some((i) => i.data.kind === 'dose')).toBe(false);
    expect(r.items.some((i) => i.data.kind === 'stock')).toBe(false);
  });

  test('bütçe aşımında dropped artar', () => {
    // SCHEDULE_BUDGET kadar benzersiz saat üret → fazlası dropped
    const times = Array.from({ length: SCHEDULE_BUDGET + 5 }, (_, i) => {
      const h = String(Math.floor(i / 60) % 24).padStart(2, '0');
      const m = String(i % 60).padStart(2, '0');
      return `${h}:${m}`;
    });
    // Tek ilaca bu kadar saat sığmaz pratikte ama plan saat birleştirir;
    // her saat ayrı slot. Birden fazla ilaçla dolduralım.
    const meds = times.map((t, i) =>
      med({
        id: `m${i}`,
        patientId: 'p1',
        name: `Med${i}`,
        doseTimes: [t],
        stockUnits: 30,
      }),
    );
    const r = planNotifications(
      [patient({ id: 'p1', fullName: 'A' })],
      meds,
      DEFAULT_SETTINGS,
    );
    expect(r.items.length).toBeLessThanOrEqual(SCHEDULE_BUDGET);
    expect(r.dropped).toBeGreaterThan(0);
  });
});

describe('oneshotTrigger', () => {
  test('gelecek tarih → date', () => {
    const now = today();
    const when = addDays(now, 2);
    when.setHours(9, 0, 0, 0);
    const t = oneshotTrigger(when, now, 'k', new Set());
    expect(t?.trigger.type).toBe('date');
  });

  test('aynı gün geçmiş saat → soon (bir kez)', () => {
    const now = new Date();
    const when = startOfDay(now);
    when.setHours(0, 0, 0, 0);
    // now'u öğlene çek ki when geçmiş olsun
    const noon = startOfDay(now);
    noon.setHours(12, 0, 0, 0);
    const nudged = new Set<string>();
    const t1 = oneshotTrigger(when, noon, 'k', nudged);
    expect(t1?.trigger.type).toBe('soon');
    if (t1?.nudgeKey) nudged.add(t1.nudgeKey);
    const t2 = oneshotTrigger(when, noon, 'k', nudged);
    expect(t2).toBeNull();
  });
});
