// Uyum (adherence) geçmişi ekranı: bir hasta için son 30 günlük uyum özeti,
// günlük takvim şeridi, ilaç bazında oran ve son 7 günün düzenlenebilir dökümü.

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useData } from '@/store/DataContext';
import {
  AdherenceSummary,
  DayLevel,
  adherenceSummary,
  dayLevel,
  indexLog,
  lastNDayKeys,
  scheduledDosesForDate,
} from '@/utils/adherence';
import { dayKeyToDate, formatTR, todayKey } from '@/utils/date';
import { colors, fontSize, spacing } from '@/theme';
import { Card, EmptyState, Loading } from '@/components/ui';
import { DoseList } from '@/components/DoseList';

const LEVEL_COLOR: Record<DayLevel, string> = {
  allTaken: colors.ok,
  someSkipped: colors.caution,
  anyMissed: colors.danger,
  future: colors.border,
  none: colors.bg,
};

// Renk tek başına ayırt edici değil (renk körlüğü): her durum için sembol + metin.
const LEVEL_SYMBOL: Record<DayLevel, string> = {
  allTaken: '✓',
  someSkipped: '–',
  anyMissed: '✕',
  future: '',
  none: '',
};

const LEVEL_TEXT: Record<DayLevel, string> = {
  allTaken: 'tümü alındı',
  someSkipped: 'atlanan var',
  anyMissed: 'kaçırılan var',
  future: 'bekliyor',
  none: 'doz yok',
};

function isFilled(level: DayLevel): boolean {
  return (
    level === 'allTaken' || level === 'someSkipped' || level === 'anyMissed'
  );
}

export default function AdherenceScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const { data, loading, getPatient, medsForPatient, setDoseStatus } = useData();

  const todayK = todayKey();
  const patient = getPatient(patientId);
  const meds = useMemo(
    () => medsForPatient(patientId),
    [medsForPatient, patientId],
  );
  const logByKey = useMemo(() => indexLog(data.doseLog), [data.doseLog]);

  const days30 = useMemo(() => lastNDayKeys(30), []);
  const summary30 = useMemo<AdherenceSummary>(
    () => adherenceSummary(meds, logByKey, days30, todayK),
    [meds, logByKey, days30, todayK],
  );

  // Takvim şeridi: her gün için durum.
  const strip = useMemo(
    () =>
      days30.map((dk) => ({
        dayKey: dk,
        level: dayLevel(scheduledDosesForDate(meds, logByKey, dk, todayK)),
      })),
    [days30, meds, logByKey, todayK],
  );

  // İlaç bazında 30 günlük oran (yalnız doz saati olanlar).
  const perMed = useMemo(
    () =>
      meds
        .filter((m) => m.doseTimes && m.doseTimes.length > 0)
        .map((m) => ({
          med: m,
          sum: adherenceSummary([m], logByKey, days30, todayK),
        })),
    [meds, logByKey, days30, todayK],
  );

  // Son 7 gün, yeniden eskiye, düzenlenebilir döküm.
  const last7 = useMemo(() => {
    const keys = lastNDayKeys(7).reverse(); // yeni -> eski
    return keys
      .map((dk) => ({
        dayKey: dk,
        doses: scheduledDosesForDate(meds, logByKey, dk, todayK),
      }))
      .filter((d) => d.doses.length > 0);
  }, [meds, logByKey, todayK]);

  if (loading) return <Loading />;

  if (!patient) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Uyum' }} />
        <EmptyState icon="search-outline" title="Hasta bulunamadı" />
      </View>
    );
  }

  const hasSchedule = perMed.length > 0;

  return (
    <>
      <Stack.Screen options={{ title: `Uyum — ${patient.fullName}` }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      >
        {!hasSchedule ? (
          <EmptyState
            icon="time-outline"
            title="Doz saati tanımlı ilaç yok"
            subtitle="Bir ilaca günlük alım saatleri eklerseniz, alınan/atlanan dozlar burada uyum geçmişi olarak izlenir."
          />
        ) : (
          <>
            {/* Özet */}
            <Card>
              <Text style={styles.bigRate}>
                {summary30.total > 0
                  ? `%${Math.round(summary30.rate * 100)}`
                  : '—'}
              </Text>
              <Text style={styles.bigRateLabel}>son 30 günde uyum</Text>
              <View style={styles.countsRow}>
                <Count n={summary30.taken} label="alındı" color={colors.ok} />
                <Count n={summary30.skipped} label="atlandı" color={colors.caution} />
                <Count n={summary30.missed} label="kaçırıldı" color={colors.danger} />
              </View>
            </Card>

            {/* Takvim şeridi */}
            <Text style={styles.sectionLabel}>Son 30 gün</Text>
            <View style={styles.strip}>
              {strip.map((c) => {
                const on = isFilled(c.level);
                return (
                  <View
                    key={c.dayKey}
                    style={[styles.cell, { backgroundColor: LEVEL_COLOR[c.level] }]}
                    accessibilityLabel={`${formatTR(dayKeyToDate(c.dayKey))}: ${LEVEL_TEXT[c.level]}`}
                  >
                    <Text
                      style={[styles.cellSym, on && styles.cellTextOn]}
                      maxFontSizeMultiplier={1.3}
                    >
                      {LEVEL_SYMBOL[c.level]}
                    </Text>
                    <Text
                      style={[styles.cellDay, on && styles.cellTextOn]}
                      maxFontSizeMultiplier={1.3}
                    >
                      {dayKeyToDate(c.dayKey).getDate()}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.legend}>
              <Legend color={colors.ok} sym="✓" label="alındı" />
              <Legend color={colors.caution} sym="–" label="atlandı" />
              <Legend color={colors.danger} sym="✕" label="kaçırıldı" />
              <Legend color={colors.border} sym="" label="bekliyor" />
            </View>

            {/* İlaç bazında */}
            <Text style={styles.sectionLabel}>İlaç bazında (son 30 gün)</Text>
            <Card>
              {perMed.map(({ med, sum }, i) => (
                <View
                  key={med.id}
                  style={[styles.medRow, i > 0 && styles.medRowBorder]}
                >
                  <Text style={styles.medName} numberOfLines={1}>
                    {med.name}
                  </Text>
                  <Text style={styles.medRate}>
                    {sum.total > 0 ? `%${Math.round(sum.rate * 100)}` : '—'}
                  </Text>
                </View>
              ))}
            </Card>

            {/* Son 7 gün dökümü (düzenlenebilir) */}
            <Text style={styles.sectionLabel}>Son 7 gün</Text>
            {last7.map(({ dayKey, doses }) => (
              <View key={dayKey} style={styles.dayBlock}>
                <Text style={styles.dayHeader}>
                  {dayKey === todayK ? 'Bugün' : formatTR(dayKeyToDate(dayKey))}
                </Text>
                <DoseList doses={doses} dayKey={dayKey} onSet={setDoseStatus} />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </>
  );
}

function Count({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <View style={styles.count}>
      <Text style={[styles.countN, { color }]}>{n}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

function Legend({
  color,
  sym,
  label,
}: {
  color: string;
  sym: string;
  label: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]}>
        {sym ? <Text style={styles.legendSym}>{sym}</Text> : null}
      </View>
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg },
  bigRate: {
    fontSize: 44,
    fontWeight: '900',
    color: colors.primary,
    textAlign: 'center',
  },
  bigRateLabel: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -4,
  },
  countsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.lg,
  },
  count: { alignItems: 'center' },
  countN: { fontSize: fontSize.xl, fontWeight: '900' },
  countLabel: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  sectionLabel: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    width: 38,
    minHeight: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellSym: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textMuted,
    lineHeight: 14,
  },
  cellDay: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    lineHeight: 14,
  },
  cellTextOn: { color: colors.white },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: {
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendSym: { fontSize: 11, fontWeight: '900', color: colors.white },
  legendText: { fontSize: fontSize.sm, color: colors.textMuted },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  medRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  medName: { flex: 1, fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  medRate: { fontSize: fontSize.lg, fontWeight: '900', color: colors.primaryDark },
  dayBlock: { marginBottom: spacing.lg },
  dayHeader: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
});
