// AsyncStorage üzerinden kalıcılık katmanı.
//
// Önemli: bu uygulama tamamen çevrimdışıdır; veriler kullanıcının tek
// değeridir. Bu yüzden okuma hatasında verileri sessizce SİLMEYİZ — bozuk
// ham veriyi ayrı bir anahtara yedekleyip kurtarılabilir bırakırız ve
// yüklemenin başarılı olup olmadığını çağırana bildiririz (clobber'ı önlemek
// için).

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';
import { AppData, DEFAULT_SETTINGS, DoseEvent, Medication, Patient } from '../types';

const STORAGE_KEY = 'ilac-takip:data:v1';
const CORRUPT_KEY = 'ilac-takip:data:corrupt';
// Geri yükleme öncesi otomatik anlık yedek (şifreli) — "geri al" için.
const PRE_RESTORE_KEY = 'ilac-takip:data:pre-restore';

// --- Cihazda şifreleme (at-rest) ---
// Hassas sağlık verisi (hasta adı, tanı notları, ilaçlar) artık düz metin
// AsyncStorage'da DEĞİL: AppData JSON'u AES-CBC ile şifrelenir; 256-bit anahtar
// SecureStore'da (iOS Keychain / Android Keystore) tutulur, IV her yazımda
// CSPRNG'den (expo-crypto) üretilir. Zarf biçimi:
//   ENC1:<ivBase64>:<ciphertextBase64>
// Eski (şifresiz) kayıtlar yüklemede saptanır ve otomatik olarak şifreliye
// yükseltilir (veri kaybı olmadan). Çözme başarısızsa ok=false döner; üstteki
// clobber-koruması sayesinde okunamayan veri ASLA boş veriyle ezilmez.
const ENC_KEY_NAME = 'ilac-takip-enc-key-v1';
const ENC_PREFIX = 'ENC1:';
let cachedKey: CryptoJS.lib.WordArray | null = null;

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

/** Şifreleme anahtarını getirir; yoksa üretip SecureStore'a yazar. */
async function getEncKey(): Promise<CryptoJS.lib.WordArray> {
  if (cachedKey) return cachedKey;
  let hex: string | null = null;
  try {
    hex = await SecureStore.getItemAsync(ENC_KEY_NAME);
  } catch {
    hex = null;
  }
  if (!hex) {
    const rand = await Crypto.getRandomBytesAsync(32); // 256-bit
    hex = bytesToHex(rand);
    await SecureStore.setItemAsync(ENC_KEY_NAME, hex);
  }
  cachedKey = CryptoJS.enc.Hex.parse(hex);
  return cachedKey;
}

async function encryptString(plain: string): Promise<string> {
  const key = await getEncKey();
  const ivBytes = await Crypto.getRandomBytesAsync(16);
  const iv = CryptoJS.enc.Hex.parse(bytesToHex(ivBytes));
  const enc = CryptoJS.AES.encrypt(plain, key, { iv });
  return (
    ENC_PREFIX +
    iv.toString(CryptoJS.enc.Base64) +
    ':' +
    enc.ciphertext.toString(CryptoJS.enc.Base64)
  );
}

async function decryptString(envelope: string): Promise<string> {
  const key = await getEncKey();
  const body = envelope.slice(ENC_PREFIX.length);
  const sep = body.indexOf(':');
  if (sep < 0) throw new Error('bozuk şifre zarfı');
  const iv = CryptoJS.enc.Base64.parse(body.slice(0, sep));
  const ct = CryptoJS.enc.Base64.parse(body.slice(sep + 1));
  const dec = CryptoJS.AES.decrypt(
    CryptoJS.lib.CipherParams.create({ ciphertext: ct }),
    key,
    { iv },
  );
  const plain = dec.toString(CryptoJS.enc.Utf8);
  if (!plain) throw new Error('çözme başarısız (anahtar uyuşmuyor?)');
  return plain;
}

async function backupCorrupt(raw: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CORRUPT_KEY, raw);
  } catch {
    /* yedekleme de başarısızsa elde olan bu */
  }
}

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
          // Migrasyon: trackStock yoksa, mevcut stok>0 ise takip ediliyor say.
          trackStock:
            typeof m.trackStock === 'boolean'
              ? m.trackStock
              : isFiniteNumber(m.stockUnits) && m.stockUnits > 0,
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

  // Şifreli zarf: çöz, sonra ayrıştır. Çözme başarısızsa ASLA ezme (ok=false).
  if (raw.startsWith(ENC_PREFIX)) {
    let plain: string;
    try {
      plain = await decryptString(raw);
    } catch (e) {
      console.warn('Veri çözülemedi (anahtar erişilemedi/uyuşmadı):', e);
      return { data: emptyData, ok: false };
    }
    try {
      return { data: sanitize(JSON.parse(plain) as Partial<AppData>), ok: true };
    } catch (e) {
      console.warn('Çözülen veri bozuk, yedekleniyor:', e);
      await backupCorrupt(raw);
      return { data: emptyData, ok: false };
    }
  }

  // Eski ŞİFRESİZ kayıt (migrasyon): oku ve otomatik olarak şifreliye yükselt.
  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const data = sanitize(parsed);
    try {
      const env = await encryptString(JSON.stringify(data));
      await AsyncStorage.setItem(STORAGE_KEY, env);
    } catch (e) {
      // Yükseltme başarısızsa veri yine de okunabilir (düz metin) kalır.
      console.warn('Şifreli yükseltme başarısız (veri korunuyor):', e);
    }
    return { data, ok: true };
  } catch (e) {
    // Bozuk JSON — ham veriyi yedekle, kurtarılabilir kalsın, ÜZERİNE YAZMA.
    console.warn('Veri bozuk, yedekleniyor:', e);
    await backupCorrupt(raw);
    return { data: emptyData, ok: false };
  }
}

export async function saveData(data: AppData): Promise<void> {
  try {
    const env = await encryptString(JSON.stringify(data));
    await AsyncStorage.setItem(STORAGE_KEY, env);
  } catch (e) {
    console.warn('Veri kaydedilemedi:', e);
  }
}

// --- Geri yükleme "geri al" anlık yedeği ---

/** Geri yükleme öncesi mevcut veriyi şifreli olarak ayrı anahtara yedekler. */
export async function savePreRestoreSnapshot(data: AppData): Promise<void> {
  try {
    const env = await encryptString(JSON.stringify(data));
    await AsyncStorage.setItem(PRE_RESTORE_KEY, env);
  } catch (e) {
    console.warn('Geri-al yedeği alınamadı:', e);
  }
}

/** Geri-al anlık yedeğini çözer (yoksa null). */
export async function loadPreRestoreSnapshot(): Promise<AppData | null> {
  try {
    const raw = await AsyncStorage.getItem(PRE_RESTORE_KEY);
    if (!raw) return null;
    const plain = raw.startsWith(ENC_PREFIX) ? await decryptString(raw) : raw;
    return sanitize(JSON.parse(plain) as Partial<AppData>);
  } catch {
    return null;
  }
}

/** Geri-al anlık yedeği var mı? */
export async function hasPreRestoreSnapshot(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PRE_RESTORE_KEY)) != null;
  } catch {
    return false;
  }
}

/** Geri-al anlık yedeğini siler. */
export async function clearPreRestoreSnapshot(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PRE_RESTORE_KEY);
  } catch {
    /* önemli değil */
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

// --- Parola ile şifreli yedek (opsiyonel) ---
// Yedek dosyası, kullanıcının belirlediği bir parola ile şifrelenebilir:
// parola -> PBKDF2-SHA256 (salt) -> 256-bit anahtar -> AES-CBC. Böylece dışa
// aktarılan dosya çalınsa bile parola olmadan PHI okunamaz.
const BACKUP_ENC = 'pbkdf2-aes-cbc';
const BACKUP_ITER = 100000;

/** Bir metin parola-şifreli yedek zarfı mı? (içe aktarımda saptama) */
export function isEncryptedBackup(text: string): boolean {
  try {
    const o = JSON.parse(text);
    return !!o && o.enc === BACKUP_ENC && typeof o.ct === 'string';
  } catch {
    return false;
  }
}

/** Yedek metnini parola ile şifreler; paylaşılabilir bir zarf (JSON) döndürür. */
export async function encryptBackup(text: string, password: string): Promise<string> {
  const saltHex = bytesToHex(await Crypto.getRandomBytesAsync(16));
  const ivHex = bytesToHex(await Crypto.getRandomBytesAsync(16));
  const key = CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(saltHex), {
    keySize: 256 / 32,
    iterations: BACKUP_ITER,
    hasher: CryptoJS.algo.SHA256,
  });
  const enc = CryptoJS.AES.encrypt(text, key, { iv: CryptoJS.enc.Hex.parse(ivHex) });
  return JSON.stringify({
    app: 'ilac-takip',
    enc: BACKUP_ENC,
    v: 1,
    iter: BACKUP_ITER,
    salt: saltHex,
    iv: ivHex,
    ct: enc.ciphertext.toString(CryptoJS.enc.Base64),
  });
}

/** Şifreli yedeği parola ile çözer. Parola yanlışsa hata fırlatır. */
export function decryptBackup(text: string, password: string): string {
  const o = JSON.parse(text);
  if (!o || o.enc !== BACKUP_ENC || typeof o.ct !== 'string') {
    throw new Error('Şifreli yedek biçimi tanınmadı.');
  }
  const key = CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(o.salt), {
    keySize: 256 / 32,
    iterations: typeof o.iter === 'number' ? o.iter : BACKUP_ITER,
    hasher: CryptoJS.algo.SHA256,
  });
  const dec = CryptoJS.AES.decrypt(
    CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(o.ct) }),
    key,
    { iv: CryptoJS.enc.Hex.parse(o.iv) },
  );
  const plain = dec.toString(CryptoJS.enc.Utf8);
  if (!plain) throw new Error('Parola yanlış olabilir.');
  return plain;
}
