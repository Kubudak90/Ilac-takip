// İlk açılış gizlilik/KVKK onay kapısı: kabul edilene kadar içerik gösterilmez.
// Kabul edilince bir daha gösterilmez (settings.privacyAccepted).

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../store/DataContext';
import { PRIVACY_TEXT, PRIVACY_TITLE } from '../privacy';
import { Button } from './ui';
import { colors, fontSize, spacing } from '../theme';

export function ConsentGate({ children }: { children: React.ReactNode }) {
  const { data, loading, updateSettings } = useData();
  const insets = useSafeAreaInsets();

  if (loading || data.settings.privacyAccepted) return <>{children}</>;

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
