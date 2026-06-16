import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useData } from '@/store/DataContext';
import { currentRemainingUnits, stockRunOutDate } from '@/utils/status';
import { addDays, formatTR, today } from '@/utils/date';
import { colors, fontSize, radius, spacing } from '@/theme';
import { Button, Card, EmptyState } from '@/components/ui';
import { NumberField } from '@/components/forms';

const QUICK_BOXES = [10, 14, 20, 28, 30, 60, 90];

export default function RefillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getMedication, refillMedication } = useData();
  const router = useRouter();

  const med = getMedication(id);
  const [added, setAdded] = useState<number>(0);

  const remaining = med ? currentRemainingUnits(med) : 0;
  const newTotal = remaining + (added || 0);

  // Yenileme sonrası tahmini bitiş
  const newRunOut = useMemo(() => {
    if (!med || med.dailyDose <= 0) return null;
    return addDays(today(), Math.floor(newTotal / med.dailyDose));
  }, [med, newTotal]);

  if (!med) {
    return (
      <View style={styles.center}>
        <EmptyState emoji="🔍" title="İlaç bulunamadı" />
      </View>
    );
  }

  function onConfirm() {
    refillMedication(id, newTotal);
    router.back();
  }

  const oldRunOut = stockRunOutDate(med);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Stack.Screen options={{ title: 'İlaç Yazdırdım' }} />

      <Card>
        <Text style={styles.medName}>{med.name}</Text>
        <Text style={styles.sub}>Günde {med.dailyDose} adet kullanılıyor</Text>
        <View style={styles.statRow}>
          <Stat label="Şu an kalan" value={`${remaining} adet`} />
          <Stat
            label="Eski bitiş"
            value={oldRunOut ? formatTR(oldRunOut) : '—'}
          />
        </View>
      </Card>

      <Text style={styles.q}>Kaç adet eklendi? (yeni kutu/reçete)</Text>
      <View style={styles.chips}>
        {QUICK_BOXES.map((n) => (
          <Text
            key={n}
            onPress={() => setAdded((a) => (a || 0) + n)}
            style={styles.chip}
          >
            +{n}
          </Text>
        ))}
        <Text onPress={() => setAdded(0)} style={[styles.chip, styles.chipClear]}>
          Sıfırla
        </Text>
      </View>

      <NumberField
        label="Eklenen toplam adet"
        value={added}
        onChangeNumber={setAdded}
        placeholder="örn. 30"
        suffix="adet"
      />

      <View style={styles.result}>
        <Text style={styles.resultLabel}>Yeni stok: {newTotal} adet</Text>
        <Text style={styles.resultDate}>
          📅 Tahmini yeni bitiş: {newRunOut ? formatTR(newRunOut) : '—'}
        </Text>
      </View>

      <Button
        title="✓ Yenilemeyi Kaydet"
        onPress={onConfirm}
        disabled={(added || 0) <= 0}
        style={{ marginTop: spacing.lg }}
      />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg },
  medName: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  sub: { fontSize: fontSize.md, color: colors.textMuted, marginTop: 2 },
  statRow: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.md },
  statLabel: { fontSize: fontSize.sm, color: colors.textMuted },
  statValue: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, marginTop: 2 },
  q: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    backgroundColor: colors.primaryLight,
    color: colors.primaryDark,
    fontWeight: '800',
    fontSize: fontSize.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  chipClear: { backgroundColor: colors.border, color: colors.text },
  result: {
    backgroundColor: colors.okBg,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  resultLabel: { fontSize: fontSize.lg, fontWeight: '900', color: colors.ok },
  resultDate: { fontSize: fontSize.md, color: colors.ok, marginTop: 4, fontWeight: '600' },
});
