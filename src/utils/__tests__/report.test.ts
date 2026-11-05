import { DoseEvent, Medication, Patient } from '../../types';
import { addDays, toISODate, today } from '../date';
import { buildPatientReport, buildPharmacyRenewalList } from '../report';

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

describe('buildPatientReport', () => {
  test('hasta özeti doktor/eczacı için tüm önemli alanları içerir', () => {
    const p = patient({ id: 'p1', fullName: 'Fatma Yılmaz', birthYear: 1948, notes: 'Hipertansiyon' });
    const m1 = med({
      id: 'm1',
      patientId: 'p1',
      name: 'Coraspin 100 mg',
      dailyDose: 1,
      stockUnits: 2,
      trackStock: true,
      mealRelation: 'after_meal',
      doseTimes: ['08:00'],
      barcode: '08699546010011',
      hasReport: true,
      reportEndDate: toISODate(addDays(today(), 5)),
    });
    const doseLog: DoseEvent[] = [];

    const text = buildPatientReport(p, [m1], 7, doseLog);
    expect(text).toContain('Fatma Yılmaz');
    expect(text).toContain('Coraspin 100 mg');
    expect(text).toContain('Tok karnına');
    expect(text).toContain('08699546010011');
    expect(text).toContain('DİKKAT / YENİLENMESİ GEREKENLER');
  });
});

describe('buildPharmacyRenewalList', () => {
  test('acil stok, rapor ve SKT ihtiyacı olan ilaçları gruplar', () => {
    const p1 = patient({ id: 'p1', fullName: 'Ahmet Demir' });
    const urgentMed = med({
      id: 'm1',
      patientId: 'p1',
      name: 'Beloc Zok 50 mg',
      stockUnits: 0,
      trackStock: true,
      barcode: '08699500000011',
    });
    const okMed = med({
      id: 'm2',
      patientId: 'p1',
      name: 'Parol 500 mg',
      stockUnits: 30,
      trackStock: true,
    });

    const list = buildPharmacyRenewalList([p1], [urgentMed, okMed], 7);
    expect(list).toContain('Ahmet Demir');
    expect(list).toContain('Beloc Zok 50 mg');
    expect(list).toContain('08699500000011');
    expect(list).not.toContain('Parol 500 mg');
  });

  test('acil ihtiyaç yoksa bilgilendirme mesajı döner', () => {
    const p1 = patient({ id: 'p1', fullName: 'Ahmet Demir' });
    const okMed = med({
      id: 'm2',
      patientId: 'p1',
      name: 'Parol 500 mg',
      stockUnits: 30,
      trackStock: true,
    });
    const list = buildPharmacyRenewalList([p1], [okMed], 7);
    expect(list).toContain('Şu an acil yazdırılması veya yenilenmesi gereken ilaç/rapor bulunmuyor.');
  });
});
