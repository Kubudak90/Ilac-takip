// İlk açılış gizlilik/KVKK onay kapısı: kabul edilene kadar içerik gösterilmez.
// Kabul edilince bir daha gösterilmez (settings.privacyAccepted).
// Red: uygulama kullanılamaz; Android'de çıkış önerilir, iOS'ta kapıda kalınır.

import React from 'react';
import { Alert, BackHandler, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../store/DataContext';
import { PRIVACY_TEXT, PRIVACY_TITLE } from '../privacy';
import { Button } from './ui';
import { colors, fontSize, spacing } from '../theme';

export function ConsentGate({ children }: { children: React.ReactNode }) {
  const { data, loading, updateSettings } = useData();
  const insets = useSafeAreaInsets();

  if (loading || data.settings.privacyAccepted) return <>{children}</>;

  function onDecline() {
    Alert.alert(
      'Onay gerekli',
      'Gizlilik aydınlatmasını kabul etmeden uygulamayı kullanamazsınız. Veriler yalnızca bu telefonda saklanır; kabul etmeden hasta kaydı açılamaz.',
      [
        { text: 'Metne dön', style: 'cancel' },
        ...(Platform.OS === 'android'
          ? [
              {
                text: 'Uygulamadan çık',
                style: 'destructive' as const,
                onPress: () => BackHandler.exitApp(),
              },
            ]
          : []),
      ],
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: insets.top + spacing.lg,
        }}
      >
        <Text style={styles.title}>{PRIVACY_TITLE}</Text>
        <Text style={styles.body}>{PRIVACY_TEXT}</Text>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title="Okudum, kabul ediyorum"
          icon="checkmark-circle-outline"
          onPress={() => updateSettings({ privacyAccepted: true })}
        />
        <Button
          title="Kabul etmiyorum"
          icon="close-circle-outline"
          variant="secondary"
          onPress={onDecline}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '900',
    color: colors.text,
    marginBottom: spacing.md,
  },
  body: { fontSize: fontSize.md, color: colors.text, lineHeight: 24 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
