import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useData } from '@/store/DataContext';
import { parseGs1 } from '@/utils/barcode';
import { toISODate } from '@/utils/date';
import { colors, fontSize, spacing } from '@/theme';
import { Button } from '@/components/ui';

export default function ScanScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const { lookupBarcode } = useData();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const handled = useRef(false);

  function onScan(data: string) {
    if (handled.current) return;
    handled.current = true;
    setScanned(true);

    const parsed = parseGs1(data);
    const params = new URLSearchParams();
    params.set('patientId', patientId);
    if (parsed.gtin) {
      params.set('barcode', parsed.gtin);
      const known = lookupBarcode(parsed.gtin);
      if (known) params.set('scannedName', known);
    }
    if (parsed.expiry) params.set('expiry', toISODate(parsed.expiry));

    // Tarama ekranını forma çevir (geri tuşu hastaya döner)
    router.replace(`/ilac/duzenle?${params.toString()}`);
  }

  // İzin durumu
  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.info}>Kamera hazırlanıyor…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Karekod Tara' }} />
        <Text style={styles.emoji}>📷</Text>
        <Text style={styles.title}>Kamera izni gerekli</Text>
        <Text style={styles.info}>
          İlaç kutusundaki karekodu okuyabilmek için kamera iznine ihtiyacımız
          var.
        </Text>
        <Button title="İzin Ver" onPress={requestPermission} style={{ marginTop: spacing.lg }} />
        <Button
          title="Vazgeç"
          variant="secondary"
          onPress={() => router.back()}
          style={{ marginTop: spacing.md }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Karekod Tara', headerShown: false }} />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['datamatrix', 'ean13', 'ean8', 'qr', 'code128', 'code39'],
        }}
        onBarcodeScanned={scanned ? undefined : ({ data }) => onScan(data)}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Text style={styles.overlayText}>
            İlaç kutusundaki karekodu çerçeveye getirin
          </Text>
        </View>
        <View style={styles.frame} />
        <View style={styles.bottomBar}>
          <Button
            title="Elle Ekle"
            variant="secondary"
            onPress={() =>
              router.replace(`/ilac/duzenle?patientId=${patientId}`)
            }
          />
          <Button
            title="Vazgeç"
            variant="primary"
            onPress={() => router.back()}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emoji: { fontSize: 56, marginBottom: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  info: { fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: { paddingTop: 60, paddingHorizontal: spacing.lg },
  overlayText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: spacing.md,
    borderRadius: 12,
  },
  frame: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: 16,
  },
  bottomBar: { padding: spacing.lg, paddingBottom: 40 },
});
