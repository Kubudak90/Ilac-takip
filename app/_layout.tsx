import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DataProvider } from '@/store/DataContext';
import { requestNotificationPermission } from '@/utils/notifications';
import { colors } from '@/theme';

export default function RootLayout() {
  useEffect(() => {
    // İlk açılışta bildirim izni iste (sessizce başarısız olabilir)
    requestNotificationPermission().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <DataProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '800' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="hasta/[id]"
            options={{ title: 'Hasta Detayı' }}
          />
          <Stack.Screen
            name="hasta/duzenle"
            options={{ title: 'Hasta', presentation: 'modal' }}
          />
          <Stack.Screen
            name="ilac/duzenle"
            options={{ title: 'İlaç', presentation: 'modal' }}
          />
          <Stack.Screen
            name="ilac/yenile"
            options={{ title: 'İlaç Yazdırdım', presentation: 'modal' }}
          />
          <Stack.Screen
            name="ilac/tara"
            options={{ title: 'Karekod Tara', presentation: 'modal' }}
          />
          <Stack.Screen
            name="yedek"
            options={{ title: 'Yedekle / Geri Yükle', presentation: 'modal' }}
          />
        </Stack>
      </DataProvider>
    </SafeAreaProvider>
  );
}
