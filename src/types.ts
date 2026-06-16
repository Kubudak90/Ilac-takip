// Uygulamanın veri modelleri

/** Bir hasta (65+ polifarmasi hastası, bakıcı tarafından takip edilir) */
export interface Patient {
  id: string;
  fullName: string;
  /** Doğum yılı (yaş hesabı için, opsiyonel) */
  birthYear?: number;
  /** Serbest not: tanılar, doktor, hastane vb. */
  notes?: string;
  createdAt: string; // ISO tarih
}

/**
 * Bir ilaç kaydı.
 *
 * Stok ne zaman biter hesabı:
 *   kalan gün = floor(stockUnits / dailyDose)
 *   bitiş tarihi = stockUpdatedAt + kalan gün
 *
 * Rapor ne zaman biter:
 *   reportEndDate alanı (varsa) takip edilir.
 */
export interface Medication {
  id: string;
  patientId: string;
  /** İlaç adı, ör. "Coraspin 100 mg" */
  name: string;
  /** Günde toplam kaç adet/doz alınıyor (ör. günde 2 = 2) */
  dailyDose: number;
  /** Şu an elde kalan toplam adet (tablet/kapsül/doz) */
  stockUnits: number;
  /** stockUnits değerinin girildiği/güncellendiği tarih (ISO) */
  stockUpdatedAt: string;
  /** Raporlu ilaç mı? */
  hasReport: boolean;
  /** Rapor bitiş tarihi (ISO, sadece hasReport=true ise anlamlı) */
  reportEndDate?: string;
  /** Serbest not (ör. "aç karnına", "sabah") */
  notes?: string;
  createdAt: string;
}

/** Uygulama ayarları */
export interface Settings {
  /** Kaç gün kala uyarı/bildirim verilsin */
  warnDaysBefore: number;
  /** Bildirimler açık mı */
  notificationsEnabled: boolean;
  /** Günlük hatırlatma saati (0-23) */
  reminderHour: number;
}

export interface AppData {
  patients: Patient[];
  medications: Medication[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  warnDaysBefore: 7,
  notificationsEnabled: true,
  reminderHour: 9,
};
