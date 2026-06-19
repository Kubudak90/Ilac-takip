// Uygulama kilidi: biyometri / cihaz ekran kilidi ile kimlik doğrulama.

import * as LocalAuthentication from 'expo-local-authentication';

/** Cihazda kilit kurulabilir mi (donanım var ve biyometri kayıtlı)? */
export async function canUseAppLock(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && enrolled;
  } catch {
    return false;
  }
}

/**
 * Kimlik doğrulama ister. Başarılıysa true. Biyometri başarısız olursa cihaz
 * şifresine düşer (disableDeviceFallback varsayılan false) — böylece biyometri
 * kaldırılsa bile kullanıcı kilitlenmez.
 */
export async function authenticate(): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'İlaç Takip kilidini aç',
      cancelLabel: 'İptal',
    });
    return res.success;
  } catch {
    return false;
  }
}
