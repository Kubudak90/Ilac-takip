// Yedekleme / geri yükleme ekranı.
//
// Uygulama çevrimdışı olduğu için veriler yalnızca telefonda durur. Telefon
// kaybolursa her şey gider. Bu ekran, tüm veriyi metin (JSON) olarak dışa
// aktarmayı (paylaş: e-posta, notlar, buluta kaydet) ve gerektiğinde geri
// yüklemeyi sağlar.

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useData } from '@/store/DataContext';
import { parseBackup, serializeBackup } from '@/store/storage';
import { colors, fontSize, radius, spacing } from '@/theme';
import { Button, Card, Section } from '@/components/ui';

export default function BackupScreen() {
  const { data, restoreData } = useData();
  const router = useRouter();
  const [importText, setImportText] = useState('');

  const patientCount = data.patients.length;
  const medCount = data.medications.length;

  async function onExport() {
    try {
      const text = serializeBackup(data);
      await Share.share({
        title: 'İlaç Takip Yedeği',
        message: text,
      });
    } catch {
      Alert.alert('Paylaşılamadı', 'Yedek paylaşılırken bir sorun oluştu.');
    }
  }

  function onImport() {
    const text = importText.trim();
    if (!text) {
      Alert.alert('Boş', 'Önce yedek metnini yapıştırın.');
      return;
    }
    let incoming;
    try {
      incoming = parseBackup(text);
    } catch {
      Alert.alert(
        'Geçersiz yedek',
        'Yapıştırdığınız metin geçerli bir İlaç Takip yedeği değil. Dışa aktarırken kopyalanan metnin tamamını yapıştırdığınızdan emin olun.',
      );
      return;
    }
    Alert.alert(
      'Geri yükle',
      `Bu yedekte ${incoming.patients.length} hasta ve ${incoming.medications.length} ilaç var. Mevcut tüm verilerin yerine bunlar yüklensin mi? Bu işlem geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Geri yükle',
          style: 'destructive',
          onPress: () => {
            restoreData(incoming);
            setImportText('');
            Alert.alert('Yüklendi', 'Veriler geri yüklendi.', [
              { text: 'Tamam', onPress: () => router.back() },
            ]);
          },
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Yedekle / Geri Yükle' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <Section title="Yedek al">
          <Card>
            <Text style={styles.body}>
              Tüm veriniz ({patientCount} hasta, {medCount} ilaç) tek bir metne
              dönüştürülür. Bu metni e-posta ile kendinize gönderin, notlara veya
              buluta kaydedin. Telefon değişince geri yükleyebilirsiniz.
            </Text>
            <Button
              title="Yedeği Paylaş / Kaydet"
              icon="share-outline"
              onPress={onExport}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </Section>

        <Section title="Geri yükle">
          <Card>
            <Text style={styles.body}>
              Daha önce aldığınız yedek metnini buraya yapıştırıp geri
              yükleyebilirsiniz.
            </Text>
            <View style={styles.warnRow}>
              <Ionicons name="warning-outline" size={15} color={colors.warning} style={{ marginRight: 4, marginTop: 2 }} />
              <Text style={styles.warn}>
                Geri yükleme, telefondaki mevcut verilerin yerine geçer.
              </Text>
            </View>
            <TextInput
              style={styles.input}
              value={importText}
              onChangeText={setImportText}
              placeholder="Yedek metnini buraya yapıştırın…"
              placeholderTextColor={colors.textLight}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              title="Yedekten Geri Yükle"
              icon="download-outline"
              variant="secondary"
              onPress={onImport}
              disabled={!importText.trim()}
            />
          </Card>
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { fontSize: fontSize.md, color: colors.textMuted, lineHeight: 22 },
  warnRow: { flexDirection: 'row', marginTop: spacing.md },
  warn: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.warning,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 120,
    fontSize: fontSize.sm,
    color: colors.text,
    textAlignVertical: 'top',
    marginVertical: spacing.md,
  },
});
