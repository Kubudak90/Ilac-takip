// Yedekleme / geri yükleme ekranı.
//
// Uygulama çevrimdışı olduğu için veriler yalnızca telefonda durur. Telefon
// kaybolursa her şey gider. Bu ekran tüm veriyi bir .json DOSYASI olarak dışa
// aktarır (e-posta/Drive/Dosyalar'a kaydedip paylaşın) ve dosyadan ya da
// yapıştırılan metinden geri yükler. Yedek, opsiyonel olarak bir PAROLA ile
// şifrelenebilir (dosya çalınsa bile PHI okunamaz).

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useData } from '@/store/DataContext';
import {
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
  parseBackup,
  serializeBackup,
} from '@/store/storage';
import { todayKey } from '@/utils/date';
import { colors, fontSize, radius, spacing } from '@/theme';
import { Button, Card, Section } from '@/components/ui';
import { SwitchField, TextField } from '@/components/forms';

export default function BackupScreen() {
  const { data, restoreData, canUndoRestore, undoRestore } = useData();
  const router = useRouter();

  const [importText, setImportText] = useState('');
  const [encrypt, setEncrypt] = useState(true);
  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const patientCount = data.patients.length;
  const medCount = data.medications.length;
  const importIsEncrypted = isEncryptedBackup(importText.trim());

  async function onExport() {
    if (busy) return;
    if (encrypt && exportPassword.trim().length < 4) {
      Alert.alert('Parola çok kısa', 'En az 4 karakterli bir parola girin (ya da şifrelemeyi kapatın).');
      return;
    }
    setBusy(true);
    try {
      let content = serializeBackup(data);
      if (encrypt) {
        // PBKDF2 bloklayıcı; önce spinner çizilsin.
        await new Promise((r) => setTimeout(r, 30));
        content = await encryptBackup(content, exportPassword);
      }
      const fileUri = `${FileSystem.documentDirectory}ilac-takip-yedek-${todayKey()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, content);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'İlaç Takip Yedeği',
        });
      } else {
        Alert.alert('Kaydedildi', 'Yedek dosyası oluşturuldu ama paylaşım kullanılamıyor.');
      }
    } catch {
      Alert.alert('Hata', 'Yedek oluşturulurken bir sorun oluştu.');
    } finally {
      setBusy(false);
    }
  }

  async function onPickFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const content = await FileSystem.readAsStringAsync(res.assets[0].uri);
      setImportText(content);
      setImportPassword('');
    } catch {
      Alert.alert('Okunamadı', 'Seçilen dosya okunamadı. Metni elle yapıştırmayı deneyin.');
    }
  }

  function onImport() {
    if (busy) return;
    const text = importText.trim();
    if (!text) {
      Alert.alert('Boş', 'Önce bir yedek dosyası seçin veya metni yapıştırın.');
      return;
    }
    if (importIsEncrypted && importPassword.trim().length === 0) {
      Alert.alert('Parola gerekli', 'Bu yedek şifreli. Lütfen yedeğin parolasını girin.');
      return;
    }
    setBusy(true);
    // PBKDF2 çözme bloklayıcı; spinner çizilsin diye küçük gecikme.
    setTimeout(() => {
      let payload = text;
      if (importIsEncrypted) {
        try {
          payload = decryptBackup(text, importPassword);
        } catch {
          setBusy(false);
          Alert.alert('Çözülemedi', 'Parola yanlış olabilir. Lütfen tekrar deneyin.');
          return;
        }
      }
      let incoming;
      try {
        incoming = parseBackup(payload);
      } catch {
        setBusy(false);
        Alert.alert(
          'Geçersiz yedek',
          'Seçtiğiniz dosya/metin geçerli bir İlaç Takip yedeği değil.',
        );
        return;
      }
      setBusy(false);
      Alert.alert(
        'Geri yükle',
        `Bu yedekte ${incoming.patients.length} hasta ve ${incoming.medications.length} ilaç var. Mevcut tüm verilerin yerine bunlar yüklensin mi? Geri yüklemeden önce otomatik bir anlık yedek alınır; hemen ardından “geri al” ile önceki verilere dönebilirsiniz.`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Geri yükle',
            style: 'destructive',
            onPress: async () => {
              await restoreData(incoming);
              setImportText('');
              setImportPassword('');
              Alert.alert('Yüklendi', 'Veriler geri yüklendi.', [
                { text: 'Tamam', onPress: () => router.back() },
              ]);
            },
          },
        ],
      );
    }, 30);
  }

  function onUndo() {
    Alert.alert(
      'Son geri yüklemeyi geri al',
      'Son geri yüklemeden önceki verilere dönülsün mü? Şu anki veriler bununla değiştirilir.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Geri dön',
          style: 'destructive',
          onPress: async () => {
            const ok = await undoRestore();
            Alert.alert(
              ok ? 'Geri alındı' : 'Yapılamadı',
              ok
                ? 'Önceki verilerinize dönüldü.'
                : 'Geri alınacak bir yedek bulunamadı.',
              [{ text: 'Tamam', onPress: () => ok && router.back() }],
            );
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
        {canUndoRestore ? (
          <Section title="Son geri yükleme">
            <Card>
              <Text style={styles.body}>
                En son geri yüklemeden önceki verileriniz güvenle saklandı.
                İsterseniz tek dokunuşla geri dönebilirsiniz.
              </Text>
              <Button
                title="Önceki verilere geri dön"
                icon="arrow-undo-outline"
                variant="secondary"
                onPress={onUndo}
                disabled={busy}
              />
            </Card>
          </Section>
        ) : null}

        <Section title="Yedek al">
          <Card>
            <Text style={styles.body}>
              Tüm veriniz ({patientCount} hasta, {medCount} ilaç) bir dosyaya
              aktarılır. Dosyayı e-posta, Drive veya Dosyalar'a kaydedin; telefon
              değişince geri yükleyin.
            </Text>

            <SwitchField
              label="Parola ile şifrele"
              description="Önerilir: dosya çalınsa bile parola olmadan hasta verileri okunamaz. Parolayı kaybederseniz bu yedek açılamaz."
              value={encrypt}
              onValueChange={setEncrypt}
            />
            {encrypt ? (
              <TextField
                label="Yedek parolası"
                value={exportPassword}
                onChangeText={setExportPassword}
                placeholder="En az 4 karakter"
                secureTextEntry
              />
            ) : (
              <View style={styles.warnRow}>
                <Ionicons name="warning-outline" size={15} color={colors.warning} style={{ marginRight: 4, marginTop: 2 }} />
                <Text style={styles.warn}>
                  Şifresiz yedek tüm hasta verisini düz metin içerir; yalnızca
                  güvenli bir yere kaydedin.
                </Text>
              </View>
            )}

            <Button
              title={busy ? 'İşleniyor…' : 'Yedeği Dosya Olarak Paylaş'}
              icon="share-outline"
              onPress={onExport}
              disabled={busy}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </Section>

        <Section title="Geri yükle">
          <Card>
            <Text style={styles.body}>
              Daha önce aldığınız yedek dosyasını seçin ya da yedek metnini
              aşağıya yapıştırın.
            </Text>
            <View style={styles.warnRow}>
              <Ionicons name="warning-outline" size={15} color={colors.warning} style={{ marginRight: 4, marginTop: 2 }} />
              <Text style={styles.warn}>
                Geri yükleme, telefondaki mevcut verilerin yerine geçer.
              </Text>
            </View>

            <Button
              title="Dosyadan Seç"
              icon="folder-open-outline"
              variant="secondary"
              onPress={onPickFile}
              disabled={busy}
              style={{ marginTop: spacing.md }}
            />

            <TextInput
              style={styles.input}
              value={importText}
              onChangeText={(t) => {
                setImportText(t);
              }}
              placeholder="…ya da yedek metnini buraya yapıştırın"
              placeholderTextColor={colors.textLight}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />

            {importIsEncrypted ? (
              <>
                <View style={styles.encRow}>
                  <Ionicons name="lock-closed" size={15} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.encNote}>Bu yedek şifreli — parolasını girin.</Text>
                </View>
                <TextField
                  label="Yedek parolası"
                  value={importPassword}
                  onChangeText={setImportPassword}
                  placeholder="Yedeği aldığınızda belirlediğiniz parola"
                  secureTextEntry
                />
              </>
            ) : null}

            <Button
              title={busy ? 'İşleniyor…' : 'Yedekten Geri Yükle'}
              icon="download-outline"
              variant="secondary"
              onPress={onImport}
              disabled={busy || !importText.trim()}
            />
            {busy ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
            ) : null}
          </Card>
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { fontSize: fontSize.md, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.md },
  warnRow: { flexDirection: 'row', marginTop: spacing.sm },
  warn: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.warning,
    fontWeight: '700',
  },
  encRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  encNote: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '700' },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 100,
    fontSize: fontSize.sm,
    color: colors.text,
    textAlignVertical: 'top',
    marginVertical: spacing.md,
  },
});
