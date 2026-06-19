// AsyncStorage üzerinden kalıcılık katmanı.
//
// Önemli: bu uygulama tamamen çevrimdışıdır; veriler kullanıcının tek
// değeridir. Bu yüzden okuma hatasında verileri sessizce SİLMEYİZ — bozuk
// ham veriyi ayrı bir anahtara yedekleyip kurtarılabilir bırakırız ve
// yüklemenin başarılı olup olmadığını çağırana bildiririz (clobber'ı önlemek
// için).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, DEFAULT_SETTINGS, DoseEvent, Medication, Patient } from '../types';

const STORAGE_KEY = 'ilac-takip:data:v1';
const CORRUPT_KEY = 'ilac-takip:data:corrupt';

export const emptyData: AppData = {
  patients: [],
  medications: [],
  doseLog: [],
  settings: DEFAULT_SETTINGS,
  barcodeBook: {},
};

export interface LoadResult {
  data: AppData;
  /** false ise depodaki veri okunamadı/bozuktu — üzerine yazmaktan kaçının. */
  ok: boolean;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Yüklenen kaydı güvenli hale getirir: geçersiz alanları temizler/sınırlar. */
function sanitize(parsed: Partial<AppData>): AppData {
  const patients: Patient[] = Array.isArray(parsed.patients)
    ? parsed.patients.filter(
        (p): p is Patient =>
          !!p && typeof p.id === 'string' && typeof p.fullName === 'string',
      )
    : [];
  const patientIds = new Set(patients.map((p) => p.id));

  const medications: Medication[] = Array.isArray(parsed.medications)
    ? parsed.medications
        .filter(
          (m): m is Medication =>
            !!m && typeof m.id === 'string' && typeof m.name === 'string',
        )
        .map((m) => ({
          ...m,
          // Negatif/NaN değerleri makul sınırlara çek
          dailyDose: isFiniteNumber(m.dailyDose) && m.dailyDose > 0 ? m.dailyDose : 1,
          stockUnits:
            isFiniteNumber(m.stockUnits) && m.stockUnits >= 0
              ? m.stockUnits
              : 0,
          stockUpdatedAt:
            typeof m.stockUpdatedAt === 'string'
              ? m.stockUpdatedAt
              : new Date().toISOString(),
        }))
        // Sahibi silinmiş ilaçları düşür (sızıntıyı önle)
        .filter((m) => patientIds.has(m.patientId))
    : [];

  const barcodeBook: Record<string, string> =
    parsed.barcodeBook && typeof parsed.barcodeBook === 'object'
      ? parsed.barcodeBook
      : {};

  // Doz günlüğü: geçersiz kayıtları ve sahibi (ilacı) silinmiş olayları düşür.
  const medById = new Map(medications.map((m) => [m.id, m]));
  const doseLog: DoseEvent[] = Array.isArray(parsed.doseLog)
    ? parsed.doseLog
        .filter(
          (e): e is DoseEvent =>
            !!e &&
            typeof e.id === 'string' &&
            typeof e.medId === 'string' &&
            typeof e.dayKey === 'string' &&
            (e.status === 'taken' || e.status === 'skipped'),
        )
        .filter((e) => medById.has(e.medId))
        .map((e) => ({
          ...e,
          // time string değilse id'den türet (id = medId|dayKey|time); '' ile
          // saklamak anahtar-senkronunu bozardı.
          time: typeof e.time === 'string' ? e.time : (e.id.split('|')[2] ?? ''),
          // patientId'yi her zaman gerçek sahibe (ilaca) göre yeniden bağla;
          // böylece deletePatient budaması güvenilir kalır.
          patientId: medById.get(e.medId)!.patientId,
          appliedUnits:
            isFiniteNumber(e.appliedUnits) && e.appliedUnits >= 0 ? e.appliedUnits : 0,
          loggedAt: typeof e.loggedAt === 'string' ? e.loggedAt : new Date().toISOString(),
        }))
    : [];

  return {
    patients,
    medications,
    doseLog,
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    barcodeBook,
  };
}

export async function loadData(): Promise<LoadResult> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch (e) {
    // Depoya erişilemedi (geçici olabilir). Veriyi silmemek için ok=false.
    console.warn('Depo okunamadı:', e);
    return { data: emptyData, ok: false };
  }

  if (!raw) return { data: emptyData, ok: true }; // gerçekten boş (ilk açılış)

  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return { data: sanitize(parsed), ok: true };
  } catch (e) {
    // Bozuk JSON — ham veriyi yedekle, kurtarılabilir kalsın, ÜZERİNE YAZMA.
    console.warn('Veri bozuk, yedekleniyor:', e);
    try {
      await AsyncStorage.setItem(CORRUPT_KEY, raw);
    } catch {
      /* yedekleme de başarısızsa elde olan bu */
    }
    return { data: emptyData, ok: false };
  }
}

export async function saveData(data: AppData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Veri kaydedilemedi:', e);
  }
}

// --- Yedekleme / geri yükleme (kullanıcı dışa/içe aktarımı) ---

/** Tüm veriyi paylaşılabilir/yedeklenebilir JSON metnine çevirir. */
export function serializeBackup(data: AppData): string {
  return JSON.stringify(
    { app: 'ilac-takip', version: 1, exportedAt: new Date().toISOString(), data },
    null,
    2,
  );
}

/**
 * Dışa aktarılmış bir yedeği çözer. Geçersizse hata fırlatır.
 * Hem {app,version,data} sarmalını hem düz AppData'yı kabul eder.
 */
export function parseBackup(text: string): AppData {
  const obj = JSON.parse(text);
  const candidate = obj && obj.data ? obj.data : obj;
  if (!candidate || (!Array.isArray(candidate.patients) && !Array.isArray(candidate.medications))) {
    throw new Error('Geçerli bir İlaç Takip yedeği değil.');
  }
  return sanitize(candidate as Partial<AppData>);
}
