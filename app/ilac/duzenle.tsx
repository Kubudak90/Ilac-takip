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
import { useData } from '@/store/DataContext';
import { Medication } from '@/types';
import { colors, fontSize, radius, spacing } from '@/theme';
import { Button } from '@/components/ui';
import { DateField, NumberField, SwitchField, TextField } from '@/components/forms';
import { addDays, formatTR, parseISO, startOfDay, toISODate, today } from '@/utils/date';

export default function EditMedicationScreen() {
  const { id, patientId } = useLocalSearchParams<{ id?: string; patientId: string }>();
  const { getMedication, addMedication, updateMedication, deleteMedication } = useData();
  const router = useRouter();

  const existing = id ? getMedication(id) : undefined;
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [dailyDose, setDailyDose] = useState<number | undefined>(existing?.dailyDose ?? 1);
  const [stockUnits, setStockUnits] = useState<number | undefined>(existing?.stockUnits ?? 0);
  const [hasReport, setHasReport] = useState(existing?.hasReport ?? false);
  const [reportEndDate, setReportEndDate] = useState<Date>(
    existing?.reportEndDate ? parseISO(existing.reportEndDate) : addDays(today(), 180),
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');

  // Canlı önizleme: girilen stok bugünden itibaren ne zaman biter?
  const previewRunOut = useMemo(() => {
    if (!dailyDose || dailyDose <= 0 || stockUnits === undefined) return null;
    const days = Math.floor((stockUnits ?? 0) / dailyDose);
    return addDays(today(), days);
  }, [dailyDose, stockUnits]);

  function onSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Eksik bilgi', 'Lütfen ilaç adını girin.');
      return;
    }
    if (!dailyDose || dailyDose <= 0) {
      Alert.alert('Eksik bilgi', 'Günde kaç adet kullanıldığını girin (en az 1).');
      return;
    }

    const stockChanged = !existing || existing.stockUnits !== (stockUnits ?? 0);

    const base: Omit<Medication, 'id' | 'createdAt'> = {
      patientId: patientId,
      name: trimmed,
      dailyDose: dailyDose,
      stockUnits: stockUnits ?? 0,
      // Stok değiştiyse referans tarihi bugüne çek
      stockUpdatedAt:
        stockChanged || !existing ? toISODate(today()) : existing.stockUpdatedAt,
      hasReport,
      reportEndDate: hasReport ? toISODate(startOfDay(reportEndDate)) : undefined,
      notes: notes.trim() || undefined,
    };

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
        <TextField
          label="İlaç Adı *"
          value={name}
          onChangeText={setName}
          placeholder="örn. Coraspin 100 mg"
        />

        <NumberField
          label="Günde kaç adet? *"
          value={dailyDose}
          onChangeNumber={setDailyDose}
          placeholder="örn. 1"
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
          <Text style={styles.previewLabel}>📅 Tahmini bitiş</Text>
          <Text style={styles.previewValue}>
            {previewRunOut ? formatTR(previewRunOut) : 'Hesaplanamadı'}
          </Text>
          <Text style={styles.previewHint}>
            Bugünden itibaren elde kalan{' '}
            {stockUnits ?? 0} adet, günde {dailyDose || 0} adetle bu tarihte biter.
          </Text>
        </View>

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
  previewLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primaryDark },
  previewValue: {
    fontSize: fontSize.xl,
    fontWeight: '900',
    color: colors.primaryDark,
    marginVertical: 4,
  },
  previewHint: { fontSize: fontSize.sm, color: colors.primaryDark, opacity: 0.8 },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.lg },
});
