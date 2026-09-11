import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useData } from '@/store/DataContext';
import { Medication } from '@/types';
import { colors, fontSize, radius, spacing } from '@/theme';
import { Button } from '@/components/ui';
import {
  DateField,
  DecimalField,
  NumberField,
  SwitchField,
  TextField,
  TimeListField,
} from '@/components/forms';
import { addDays, formatDose, formatTR, parseISO, startOfDay, toISODate, today } from '@/utils/date';

export default function EditMedicationScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    patientId: string;
    barcode?: string;
    scannedName?: string;
    expiry?: string; // ISO
  }>();
  const { id, patientId } = params;
  const {
    getMedication,
    addMedication,
    updateMedication,
    deleteMedication,
    saveBarcodeName,
  } = useData();
  const router = useRouter();

  const existing = id ? getMedication(id) : undefined;
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? params.scannedName ?? '');
  const [dailyDose, setDailyDose] = useState<number | undefined>(existing?.dailyDose ?? 1);
  const [stockUnits, setStockUnits] = useState<number | undefined>(existing?.stockUnits ?? 0);
  const [doseTimes, setDoseTimes] = useState<string[]>(existing?.doseTimes ?? []);

  const [hasReport, setHasReport] = useState(existing?.hasReport ?? false);
  const [reportEndDate, setReportEndDate] = useState<Date>(
    existing?.reportEndDate ? parseISO(existing.reportEndDate) : addDays(today(), 180),
  );

  const initialExpiry = existing?.expiryDate ?? params.expiry;
  const [hasExpiry, setHasExpiry] = useState(!!initialExpiry);
  const [expiryDate, setExpiryDate] = useState<Date>(
    initialExpiry ? parseISO(initialExpiry) : addDays(today(), 365),
  );

  const [barcode] = useState<string | undefined>(existing?.barcode ?? params.barcode);
  const [notes, setNotes] = useState(existing?.notes ?? '');

  // Canlı önizleme: status.stockRunOutDate ile aynı formül (bugünden ileri).
  // Salt-hatırlatma (stok hiç girilmemiş / trackStock yok) için önizleme yok.
  const previewRunOut = useMemo(() => {
    if (!dailyDose || dailyDose <= 0 || stockUnits === undefined) return null;
    const willTrack = (stockUnits ?? 0) > 0 || !!existing?.trackStock;
    if (!willTrack) return null;
    const days = Math.floor(Math.max(0, stockUnits ?? 0) / dailyDose);
    return addDays(today(), days);
  }, [dailyDose, stockUnits, existing]);

  function onSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Eksik bilgi', 'Lütfen ilaç adını girin.');
      return;
    }
    if (!dailyDose || dailyDose <= 0) {
      Alert.alert('Eksik bilgi', 'Günde kaç adet kullanıldığını girin (yarım için 0,5).');
      return;
    }

    const stockChanged = !existing || existing.stockUnits !== (stockUnits ?? 0);

    const base: Omit<Medication, 'id' | 'createdAt'> = {
      patientId,
      name: trimmed,
      dailyDose,
      stockUnits: stockUnits ?? 0,
      // Stok bir kez girilince (>0) takip kalıcı olur; tükense bile true kalır.
      trackStock: (stockUnits ?? 0) > 0 ? true : existing?.trackStock,
      stockUpdatedAt:
        stockChanged || !existing ? toISODate(today()) : existing.stockUpdatedAt,
      doseTimes: doseTimes.length ? doseTimes : undefined,
      hasReport,
      reportEndDate: hasReport ? toISODate(startOfDay(reportEndDate)) : undefined,
      barcode,
      expiryDate: hasExpiry ? toISODate(startOfDay(expiryDate)) : undefined,
      notes: notes.trim() || undefined,
    };

    // Barkod defterini öğret: bu GTIN için adı hatırla
    if (barcode) saveBarcodeName(barcode, trimmed);

    if (isEdit && existing) {
      updateMedication(existing.id, base);
    } else {
      addMedication(base);
    }
    router.back();
  }

  function confirmDelete() {
    if (!existing) return;
    Alert.alert('İlacı sil', `${existing.name} silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          deleteMedication(existing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: isEdit ? 'İlacı Düzenle' : 'Yeni İlaç' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {!isEdit ? (
          <Button
            title="Karekod Tara"
            icon="qr-code-outline"
            variant="secondary"
            onPress={() => router.push(`/ilac/tara?patientId=${patientId}`)}
            style={{ marginBottom: spacing.lg }}
          />
        ) : null}

        {barcode ? (
          <View style={styles.barcodeNote}>
            <Ionicons name="cube-outline" size={15} color={colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={styles.barcodeText}>Barkod: {barcode}</Text>
          </View>
        ) : null}

        <TextField
          label="İlaç Adı *"
          value={name}
          onChangeText={setName}
          placeholder="örn. Coraspin 100 mg"
        />

        <DecimalField
          label="Günde kaç adet? *"
          value={dailyDose}
          onChangeNumber={setDailyDose}
          placeholder="örn. 1 (yarım için 0,5)"
          suffix="adet/gün"
        />

        <NumberField
          label="Elde kalan toplam adet"
          value={stockUnits}
          onChangeNumber={setStockUnits}
          placeholder="örn. 28"
          suffix="adet"
        />

        {/* Canlı önizleme */}
        <View style={styles.preview}>
          <View style={styles.previewLabelRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.primaryDark} style={{ marginRight: 4 }} />
            <Text style={styles.previewLabel}>Tahmini bitiş</Text>
          </View>
          <Text style={styles.previewValue}>
            {previewRunOut ? formatTR(previewRunOut) : 'Hesaplanamadı'}
          </Text>
          <Text style={styles.previewHint}>
            Elde kalan {stockUnits ?? 0} adet, günde {formatDose(dailyDose || 0)} adetle bu tarihte biter.
          </Text>
        </View>

        <TimeListField
          label="İlaç saatleri (günlük hatırlatma)"
          times={doseTimes}
          onChange={setDoseTimes}
        />

        <View style={styles.divider} />

        <SwitchField
          label="Bu ilaç raporlu mu?"
          description="Raporluysa rapor bitiş tarihini de takip ederiz."
          value={hasReport}
          onValueChange={setHasReport}
        />
        {hasReport ? (
          <DateField
            label="Rapor bitiş tarihi"
            value={reportEndDate}
            onChange={setReportEndDate}
          />
        ) : null}

        <SwitchField
          label="Kutu son kullanma tarihi"
          description="Karekod okutunca otomatik dolar; elle de girebilirsiniz."
          value={hasExpiry}
          onValueChange={setHasExpiry}
        />
        {hasExpiry ? (
          <DateField label="Son kullanma" value={expiryDate} onChange={setExpiryDate} />
        ) : null}

        <TextField
          label="Notlar"
          value={notes}
          onChangeText={setNotes}
          placeholder="örn. sabah aç karnına"
          multiline
        />

        <Button title={isEdit ? 'Kaydet' : 'İlacı Ekle'} onPress={onSave} />

        {isEdit ? (
          <Button
            title="İlacı Sil"
            variant="danger"
            onPress={confirmDelete}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  preview: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  previewLabelRow: { flexDirection: 'row', alignItems: 'center' },
  previewLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primaryDark },
  previewValue: {
    fontSize: fontSize.xl,
    fontWeight: '900',
    color: colors.primaryDark,
    marginVertical: 4,
  },
  previewHint: { fontSize: fontSize.sm, color: colors.primaryDark, opacity: 0.8 },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.lg },
  barcodeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  barcodeText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600' },
});
