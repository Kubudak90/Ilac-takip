import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useData } from '@/store/DataContext';
import { MealRelation, Medication, ScheduleType } from '@/types';
import { colors, fontSize, radius, spacing } from '@/theme';
import { Button, Label } from '@/components/ui';
import {
  DateField,
  DecimalField,
  NumberField,
  SwitchField,
  TextField,
  TimeListField,
} from '@/components/forms';
import { addDays, formatDose, formatTR, parseISO, startOfDay, toISODate, today } from '@/utils/date';
import { WEEKDAY_DISPLAY_ORDER, WEEKDAY_SHORT_TR } from '@/utils/adherence';

const SCHEDULE_OPTIONS: { key: ScheduleType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'daily', label: 'Her gün', icon: 'calendar-outline' },
  { key: 'weekdays', label: 'Belirli günler', icon: 'today-outline' },
  { key: 'interval', label: 'Gün aralıklı', icon: 'repeat-outline' },
  { key: 'prn', label: 'İhtiyaç halinde', icon: 'medkit-outline' },
];

const MEAL_OPTIONS: { key: MealRelation; label: string }[] = [
  { key: 'none', label: 'Belirtilmemiş' },
  { key: 'before_meal', label: 'Aç karnına' },
  { key: 'after_meal', label: 'Tok karnına' },
  { key: 'with_meal', label: 'Yemekle birlikte' },
];

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
    undoLastDelete,
  } = useData();
  const router = useRouter();

  const existing = id ? getMedication(id) : undefined;
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? params.scannedName ?? '');
  const [dailyDose, setDailyDose] = useState<number | undefined>(existing?.dailyDose ?? 1);
  const [stockUnits, setStockUnits] = useState<number | undefined>(existing?.stockUnits ?? 0);
  const [doseTimes, setDoseTimes] = useState<string[]>(existing?.doseTimes ?? []);

  const [scheduleType, setScheduleType] = useState<ScheduleType>(
    existing?.scheduleType ?? 'daily',
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    existing?.weekdays && existing.weekdays.length > 0 ? existing.weekdays : [1, 3, 5],
  );
  const [intervalDays, setIntervalDays] = useState<number | undefined>(
    existing?.intervalDays ?? 2,
  );
  const [mealRelation, setMealRelation] = useState<MealRelation>(
    existing?.mealRelation ?? 'none',
  );

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
  // Stok takibi: stok>0 girilince varsayılan açılır; kullanıcı kapatabilir.
  const [trackStock, setTrackStock] = useState(
    !!existing?.trackStock || (existing?.stockUnits ?? 0) > 0,
  );

  function toggleWeekday(day: number) {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  // Ortalama günlük tüketim (esnek takvim desteğiyle)
  const effectiveDaily = useMemo(() => {
    if (!dailyDose || dailyDose <= 0) return 0;
    if (scheduleType === 'prn') return 0;
    if (scheduleType === 'weekdays') {
      if (weekdays.length === 0) return 0;
      return (dailyDose * weekdays.length) / 7;
    }
    if (scheduleType === 'interval') {
      const iv = intervalDays && intervalDays >= 2 ? intervalDays : 2;
      return dailyDose / iv;
    }
    return dailyDose;
  }, [dailyDose, scheduleType, weekdays, intervalDays]);

  // Canlı önizleme: status.stockRunOutDate ile aynı formül (bugünden ileri).
  // Salt-hatırlatma / takip kapalı / PRN için önizleme yok.
  const previewRunOut = useMemo(() => {
    if (effectiveDaily <= 0 || stockUnits === undefined) return null;
    if (!trackStock) return null;
    const days = Math.floor(Math.max(0, stockUnits ?? 0) / effectiveDaily);
    return addDays(today(), days);
  }, [effectiveDaily, stockUnits, trackStock]);

  function onSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Eksik bilgi', 'Lütfen ilaç adını girin.');
      return;
    }
    if (!dailyDose || dailyDose <= 0) {
      Alert.alert('Eksik bilgi', 'Kullanım gününde kaç adet alındığını girin (yarım için 0,5).');
      return;
    }
    if (scheduleType === 'weekdays' && weekdays.length === 0) {
      Alert.alert('Eksik bilgi', 'Lütfen haftanın en az bir gününü seçin.');
      return;
    }
    if (scheduleType === 'interval' && (!intervalDays || intervalDays < 2)) {
      Alert.alert('Eksik bilgi', 'Gün aralığı en az 2 gün olmalıdır (örn. gün aşırı için 2).');
      return;
    }

    const stockChanged = !existing || existing.stockUnits !== (stockUnits ?? 0);

    const base: Omit<Medication, 'id' | 'createdAt'> = {
      patientId,
      name: trimmed,
      dailyDose,
      stockUnits: stockUnits ?? 0,
      // Açık anahtar takip eder; kullanıcı kapatırsa "tükendi" döngüsü kesilir.
      trackStock,
      stockUpdatedAt:
        stockChanged || !existing ? toISODate(today()) : existing.stockUpdatedAt,
      doseTimes: scheduleType === 'prn' ? undefined : doseTimes.length ? doseTimes : undefined,
      scheduleType,
      weekdays: scheduleType === 'weekdays' ? weekdays : undefined,
      intervalDays: scheduleType === 'interval' ? intervalDays : undefined,
      intervalStartDate:
        scheduleType === 'interval'
          ? existing?.intervalStartDate ?? toISODate(today())
          : undefined,
      mealRelation: mealRelation !== 'none' ? mealRelation : undefined,
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
          const medName = existing.name;
          deleteMedication(existing.id);
          Alert.alert('Silindi', `${medName} silindi.`, [
            {
              text: 'Geri al',
              onPress: () => {
                if (!undoLastDelete()) {
                  Alert.alert('Yapılamadı', 'Silme geri alınamadı.');
                }
              },
            },
            { text: 'Tamam', onPress: () => router.back() },
          ]);
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
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
          <View
            style={[
              styles.barcodeNote,
              { backgroundColor: colors.bg, borderColor: colors.border },
            ]}
          >
            <Ionicons name="cube-outline" size={15} color={colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={[styles.barcodeText, { color: colors.textMuted, fontSize: fontSize.sm }]}>
              Barkod: {barcode}
            </Text>
          </View>
        ) : null}

        <TextField
          label="İlaç Adı *"
          value={name}
          onChangeText={setName}
          placeholder="örn. Coraspin 100 mg"
        />

        {/* Kullanım sıklığı / takvimi */}
        <View style={{ marginBottom: spacing.lg }}>
          <Label>Kullanım Sıklığı</Label>
          <View style={styles.optionGrid}>
            {SCHEDULE_OPTIONS.map((opt) => {
              const active = scheduleType === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setScheduleType(opt.key)}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={15}
                    color={active ? '#FFF' : colors.textMuted}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: '700',
                      color: active ? '#FFF' : colors.text,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {scheduleType === 'weekdays' ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, marginBottom: 8 }}>
                İlacın alınacağı günleri seçin:
              </Text>
              <View style={styles.weekdayRow}>
                {WEEKDAY_DISPLAY_ORDER.map((dayIdx) => {
                  const active = weekdays.includes(dayIdx);
                  return (
                    <Pressable
                      key={dayIdx}
                      onPress={() => toggleWeekday(dayIdx)}
                      style={[
                        styles.weekdayChip,
                        {
                          backgroundColor: active ? colors.primary : colors.card,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: '800',
                          color: active ? '#FFF' : colors.text,
                        }}
                      >
                        {WEEKDAY_SHORT_TR[dayIdx]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {scheduleType === 'interval' ? (
            <View style={{ marginTop: spacing.md }}>
              <View style={[styles.optionGrid, { marginBottom: spacing.sm }]}>
                {[
                  { days: 2, label: 'Gün aşırı (2 gün)' },
                  { days: 3, label: '3 günde bir' },
                  { days: 7, label: 'Haftada bir (7 gün)' },
                ].map((preset) => {
                  const active = intervalDays === preset.days;
                  return (
                    <Pressable
                      key={preset.days}
                      onPress={() => setIntervalDays(preset.days)}
                      style={[
                        styles.optionChip,
                        {
                          backgroundColor: active ? colors.primaryLight : colors.card,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: '700',
                          color: active ? colors.primaryDark : colors.text,
                        }}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <NumberField
                label="Kaç günde bir alınıyor?"
                value={intervalDays}
                onChangeNumber={setIntervalDays}
                placeholder="örn. 2"
                suffix="günde bir"
              />
            </View>
          ) : null}

          {scheduleType === 'prn' ? (
            <View
              style={[
                styles.prnNote,
                { backgroundColor: colors.primaryLight, borderColor: colors.primary },
              ]}
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={colors.primaryDark}
                style={{ marginRight: 8 }}
              />
              <Text style={{ flex: 1, fontSize: fontSize.sm, color: colors.primaryDark }}>
                İhtiyaç halinde (lüzum halinde) kullanılan ilaçlar için sabit saat alarmı kurulmaz. Hasta ekranındaki &ldquo;İhtiyaç Dozu Aldım&rdquo; düğmesiyle alındıkça stoktan düşülür.
              </Text>
            </View>
          ) : null}
        </View>

        <DecimalField
          label={
            scheduleType === 'prn'
              ? 'Her kullanımda kaç adet? *'
              : 'Kullanım gününde kaç adet? *'
          }
          value={dailyDose}
          onChangeNumber={setDailyDose}
          placeholder="örn. 1 (yarım için 0,5)"
          suffix="adet"
        />

        {/* Aç / Tok / Yemekle durumu */}
        <View style={{ marginBottom: spacing.lg }}>
          <Label>Kullanım Şekli (Aç / Tok)</Label>
          <View style={styles.optionGrid}>
            {MEAL_OPTIONS.map((opt) => {
              const active = mealRelation === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setMealRelation(opt.key)}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: '700',
                      color: active ? '#FFF' : colors.text,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <NumberField
          label="Elde kalan toplam adet"
          value={stockUnits}
          onChangeNumber={(n) => {
            setStockUnits(n);
            // Stok girilince takibi otomatik aç (kullanıcı sonra kapatabilir).
            if ((n ?? 0) > 0) setTrackStock(true);
          }}
          placeholder="örn. 28"
          suffix="adet"
        />

        <SwitchField
          label="Stok takibi"
          description="Kapalıysa yalnız saat hatırlatması yapılır; “tükendi” ve stok bitiş uyarısı üretilmez."
          value={trackStock}
          onValueChange={setTrackStock}
        />

        {/* Canlı önizleme */}
        <View style={[styles.preview, { backgroundColor: colors.primaryLight }]}>
          <View style={styles.previewLabelRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.primaryDark} style={{ marginRight: 4 }} />
            <Text style={[styles.previewLabel, { color: colors.primaryDark, fontSize: fontSize.sm }]}>
              Tahmini bitiş
            </Text>
          </View>
          <Text style={[styles.previewValue, { color: colors.primaryDark, fontSize: fontSize.xl }]}>
            {scheduleType === 'prn'
              ? 'İhtiyaç halinde (sabit bitiş yok)'
              : previewRunOut
                ? formatTR(previewRunOut)
                : trackStock
                  ? 'Hesaplanamadı'
                  : 'Stok takibi kapalı'}
          </Text>
          <Text style={[styles.previewHint, { color: colors.primaryDark, fontSize: fontSize.sm }]}>
            {scheduleType === 'prn'
              ? `Elde ${stockUnits ?? 0} adet var; her kullanımda ${formatDose(dailyDose || 0)} adet düşülür.`
              : trackStock
                ? `Elde kalan ${stockUnits ?? 0} adet, seçili takvimle ortalama günde ${formatDose(Math.round(effectiveDaily * 100) / 100)} adet tüketimle bu tarihte biter.`
                : 'Salt hatırlatma — stok bitiş tarihi hesaplanmaz.'}
          </Text>
        </View>

        {scheduleType !== 'prn' ? (
          <TimeListField
            label="İlaç saatleri (hatırlatma)"
            times={doseTimes}
            onChange={setDoseTimes}
          />
        ) : null}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

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
          placeholder="örn. bol su ile içilecek"
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
  container: { flex: 1 },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  weekdayChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  prnNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  preview: {
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  previewLabelRow: { flexDirection: 'row', alignItems: 'center' },
  previewLabel: { fontWeight: '700' },
  previewValue: {
    fontWeight: '900',
    marginVertical: 4,
  },
  previewHint: { opacity: 0.85 },
  divider: { height: 1, marginBottom: spacing.lg },
  barcodeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  barcodeText: { fontWeight: '600' },
});

