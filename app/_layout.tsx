import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DataProvider, useData } from '@/store/DataContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LockGate } from '@/components/LockGate';
import { ConsentGate } from '@/components/ConsentGate';
import { NotificationRouter } from '@/components/NotificationRouter';
import { requestNotificationPermission } from '@/utils/notifications';
import { applyTheme, colors } from '@/theme';

function ThemedStack() {
  const { data } = useData();
  const { darkMode, largeText } = data.settings;
  applyTheme({ darkMode, largeText });
  const themeKey = `${darkMode ? 'dark' : 'light'}-${largeText ? 'lg' : 'md'}`;

  return (
    <>
      <StatusBar style="light" />
      <LockGate>
        <ConsentGate>
          <NotificationRouter />
          <Stack
            key={themeKey}
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
            <Stack.Screen name="uyum" options={{ title: 'Uyum Geçmişi' }} />
            <Stack.Screen
              name="gizlilik"
              options={{ title: 'Gizlilik', presentation: 'modal' }}
            />
          </Stack>
        </ConsentGate>
      </LockGate>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // İlk açılışta bildirim izni iste (sessizce başarısız olabilir)
    requestNotificationPermission().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <DataProvider>
          <ThemedStack />
        </DataProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

