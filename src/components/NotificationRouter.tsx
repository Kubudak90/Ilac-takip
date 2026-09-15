// Bildirime dokununca ilgili ekrana götürür.
// - Bitiş/rapor/son-kullanma: data.medicationId -> hasta detayı
// - Doz / tükenme: data.patientId varsa hasta, yoksa Özet

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
    if (!response || loading) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;

    const data = response.notification.request.content.data as
      | { medicationId?: string; patientId?: string; kind?: string }
      | undefined;

    const clear = () => {
      void Notifications.clearLastNotificationResponseAsync?.();
    };

    const medId = data?.medicationId;
    if (medId) {
      const med = getMedication(medId);
      if (med) {
        router.push(`/hasta/${med.patientId}`);
        clear();
        return;
      }
    }
    if (data?.patientId) {
      router.push(`/hasta/${data.patientId}`);
      clear();
      return;
    }
    if (data?.kind === 'dose' || data?.kind === 'depleted') {
      router.push('/');
      clear();
    }
  }, [response, loading, router, getMedication]);

  return null;
}
