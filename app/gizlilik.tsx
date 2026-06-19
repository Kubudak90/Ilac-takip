// Gizlilik / KVKK metnini her zaman gösteren ekran (Ayarlar'dan erişilir).

import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';
import { PRIVACY_TEXT, PRIVACY_TITLE } from '@/privacy';
import { colors, fontSize, spacing } from '@/theme';

export default function PrivacyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: PRIVACY_TITLE }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      >
        <Text style={styles.body}>{PRIVACY_TEXT}</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { fontSize: fontSize.md, color: colors.text, lineHeight: 24 },
});
