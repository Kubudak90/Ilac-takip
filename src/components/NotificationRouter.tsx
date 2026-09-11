// Bildirime dokununca ilgili ekrana götürür.
// - Bitiş/rapor/son-kullanma: data.medicationId -> hasta detayı
// - Doz / tükenme eskalasyonu: Özet sekmesi (Bugün / Tükendi)

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useData } from '../store/DataContext';

export function NotificationRouter() {
  const response = Notifications.useLastNotificationResponse();
  const router = useRouter();
  const { getMedication, loading } = useData();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response || loading) return; // veri yüklenmeden gezinme
    const id = response.notification.request.identifier;
    if (handled.current === id) return; // aynı yanıtı tekrar işleme
    handled.current = id;

    const data = response.notification.request.content.data as
      | { medicationId?: string; kind?: string }
      | undefined;
    const medId = data?.medicationId;
    if (medId) {
      const med = getMedication(medId);
      if (med) router.push(`/hasta/${med.patientId}`);
      return;
    }
    if (data?.kind === 'dose' || data?.kind === 'depleted') {
      router.push('/');
    }
  }, [response, loading, router, getMedication]);

  return null;
}
