// Bildirime dokununca ilgili ekrana götürür.
// - Bitiş/rapor/son-kullanma: data.medicationId -> hasta detayı
// - Doz / tükenme: data.patientId varsa hasta, yoksa Özet
// Web'de expo-notifications response API'si yok — native'de çalışır (iOS/Android).

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useData } from '../store/DataContext';

export function NotificationRouter() {
  // Hook yalnızca native'de: web'de getLastNotificationResponseAsync yok.
  if (Platform.OS === 'web') return null;
  return <NotificationRouterNative />;
}

function NotificationRouterNative() {
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
      try {
        void Notifications.clearLastNotificationResponseAsync?.();
      } catch {
        /* yoksa sorun değil */
      }
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
