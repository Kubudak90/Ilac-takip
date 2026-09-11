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
 * Stok ne zaman biter (yalnızca trackStock=true iken):
 *   kalan gün = floor(stockUnits / dailyDose)
 *   bitiş tarihi = bugün + kalan gün
 * Stok gerçek sayımdır; "Aldım" işaretlemesiyle düşer. Salt-hatırlatma
 * ilaçlarında (trackStock yok) stok aciliyeti hesaplanmaz.
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
  /**
   * Bu ilacın stoğu takip ediliyor mu? Stok bir kez girilince (>0) kalıcı olarak
   * true olur ve sonradan 0'a düşse (tükense) bile true kalır — böylece "tükendi"
   * ile "stok hiç girilmedi" ayırt edilir. Salt-hatırlatma ilaçlarında false.
   */
  trackStock?: boolean;
  /** Raporlu ilaç mı? */
  hasReport: boolean;
  /** Rapor bitiş tarihi (ISO, sadece hasReport=true ise anlamlı) */
  reportEndDate?: string;
  /** Günlük alım saatleri, "HH:MM" biçiminde (ör. ["08:00","20:00"]) */
  doseTimes?: string[];
  /** İlaç kutusundaki karekoddan okunan barkod (GTIN, 14 hane) */
  barcode?: string;
  /** Kutu son kullanma tarihi (ISO, karekoddan okunur) */
  expiryDate?: string;
  /** Serbest not (ör. "aç karnına", "sabah") */
  notes?: string;
  createdAt: string;
}

/**
 * Bir doz-alım olayı (adherence/uyum kaydı).
 *
 * Doğal anahtar: `${medId}|${dayKey}|${time}` — bir ilacın belirli bir gündeki
 * belirli saat-yuvası için tek kayıt. Bu sayede işaretleme idempotenttir ve
 * çift kayıt oluşmaz.
 *
 * Stok artık GERÇEK sayımdır (tahmini azalma yok): "taken" olduğunda stoktan
 * `appliedUnits` kadar düşülür; işaret geri alınınca aynı miktar iade edilir.
 */
export interface DoseEvent {
  /** `${medId}|${dayKey}|${time}` */
  id: string;
  medId: string;
  patientId: string;
  /** Yerel gün, "YYYY-MM-DD" */
  dayKey: string;
  /** Planlı saat "HH:MM" */
  time: string;
  status: 'taken' | 'skipped';
  /** Stoktan gerçekten düşülen miktar (skipped ise 0); geri-alma için. */
  appliedUnits: number;
  /** İşaretlenme zamanı (ISO). */
  loggedAt: string;
}

/** Uygulama ayarları */
export interface Settings {
  /** Kaç gün kala uyarı/bildirim verilsin */
  warnDaysBefore: number;
  /** Bildirimler açık mı */
  notificationsEnabled: boolean;
  /** Günlük hatırlatma saati (0-23) */
  reminderHour: number;
  /** Uygulama açılışında/öne gelince biyometri/cihaz kilidi istensin mi */
  appLockEnabled: boolean;
  /** Bildirimlerde hasta/ilaç adı gizlensin mi (kilit ekranı gizliliği) */
  hideSensitiveNotifications: boolean;
  /** İlk açılış gizlilik/KVKK aydınlatması kabul edildi mi */
  privacyAccepted: boolean;
}

export interface AppData {
  patients: Patient[];
  medications: Medication[];
  /** Doz-alım günlüğü (uyum geçmişi). */
  doseLog: DoseEvent[];
  settings: Settings;
  /**
   * Barkod defteri: okutulan bir GTIN için en son kullanılan ilaç adı.
   * Aynı kutu tekrar okutulduğunda ad otomatik dolar (uygulama öğrenir).
   */
  barcodeBook: Record<string, string>;
}

export const DEFAULT_SETTINGS: Settings = {
  warnDaysBefore: 7,
  notificationsEnabled: true,
  reminderHour: 9,
  appLockEnabled: false,
  hideSensitiveNotifications: false,
  privacyAccepted: false,
};
