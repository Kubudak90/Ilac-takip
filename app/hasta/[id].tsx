import React, { useMemo } from 'react';
import { Alert, Share, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useData } from '@/store/DataContext';
import { Medication, Patient } from '@/types';
import { colors, fontSize, spacing } from '@/theme';
import { Button, Card, EmptyState, Loading } from '@/components/ui';
import { MedicationCard } from '@/components/MedicationCard';
import { DoseList } from '@/components/DoseList';
import { currentRemainingUnits, mostUrgentForMedication, stockRunOutDate } from '@/utils/status';
import {
  adherenceSummary,
  indexLog,
  lastNDayKeys,
  scheduledDosesForDate,
} from '@/utils/adherence';
import { formatDose, formatTR, formatTRFromISO, todayKey } from '@/utils/date';

/** Doktor/eczane ziyareti için paylaşılabilir ilaç listesi metni. */
function buildPatientReport(
  patient: Patient,
  meds: Medication[],
  warnDays: number,
): string {
  const age = patient.birthYear
    ? `${new Date().getFullYear() - patient.birthYear} yaşında`
    : '';
  const lines: string[] = [`${patient.fullName}${age ? ` (${age})` : ''} — İlaç Listesi`, ''];
  if (meds.length === 0) lines.push('Kayıtlı ilaç yok.');
  meds.forEach((m, i) => {
    lines.push(`${i + 1}. ${m.name}`);
    lines.push(`   Günde ${formatDose(m.dailyDose)} adet · Tahmini kalan ~${Math.round(currentRemainingUnits(m))} adet`);
    const runOut = stockRunOutDate(m);
    if (runOut) lines.push(`   Tahmini bitiş: ${formatTR(runOut)}`);
    if (m.doseTimes && m.doseTimes.length)
      lines.push(`   Saatler: ${m.doseTimes.join(', ')}`);
    if (m.hasReport && m.reportEndDate)
      lines.push(`   Rapor bitiş: ${formatTRFromISO(m.reportEndDate)}`);
    if (m.expiryDate) lines.push(`   Son kullanma: ${formatTRFromISO(m.expiryDate)}`);
    if (m.notes) lines.push(`   Not: ${m.notes}`);
    lines.push('');
  });
  lines.push('— İlaç Takip uygulamasından paylaşıldı');
  return lines.join('\n');
}

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, getPatient, medsForPatient, deletePatient, setDoseStatus } =
    useData();
  const router = useRouter();
  const warnDays = data.settings.warnDaysBefore;
  // En pahalı türetme: tüm doz günlüğünü Map'e indekslemek. Her render yerine
  // yalnızca doseLog değişince yeniden hesapla (hook erken-return'lerden önce).
  const logByKey = useMemo(() => indexLog(data.doseLog), [data.doseLog]);

  if (loading) return <Loading />;
  const patient = getPatient(id);

  if (!patient) {
    return (
      <View style={styles.center}>
        <EmptyState icon="search-outline" title="Hasta bulunamadı" />
      </View>
    );
  }

  // En acil ilaç en üstte
  const meds = [...medsForPatient(id)].sort((a, b) => {
    const ua = mostUrgentForMedication(a, warnDays);
    const ub = mostUrgentForMedication(b, warnDays);
    return (ua?.daysLeft ?? Infinity) - (ub?.daysLeft ?? Infinity);
  });
  const age = patient.birthYear
    ? new Date().getFullYear() - patient.birthYear
    : undefined;

  // Uyum: bugünün dozları + son 30 gün özeti (yalnız doz saati olan ilaçlar).
  const todayK = todayKey();
  const todayDoses = scheduledDosesForDate(meds, logByKey, todayK, todayK);
  const summary30 = adherenceSummary(meds, logByKey, lastNDayKeys(30), todayK);
  const hasSchedule = meds.some((m) => m.doseTimes && m.doseTimes.length > 0);

  async function onShare() {
    Alert.alert(
      'Listeyi paylaş',
      'Bu liste hasta adı ve ilaç bilgilerini düz metin olarak paylaşır. Yalnızca güvendiğiniz kişi veya uygulamalarla paylaşın.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Paylaş',
          onPress: async () => {
            try {
              await Share.share({
                title: `${patient!.fullName} — İlaç Listesi`,
                message: buildPatientReport(patient!, meds, warnDays),
              });
            } catch {
              Alert.alert('Paylaşılamadı', 'Liste paylaşılırken bir sorun oluştu.');
            }
          },
        },
      ],
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Hastayı sil',
      `${patient!.fullName} ve tüm ilaç kayıtları silinsin mi? Bu işlem geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            deletePatient(id);
            router.back();
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: patient.fullName }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      >
        <Card>
          <Text style={styles.name}>{patient.fullName}</Text>
          <Text style={styles.sub}>
            {age ? `${age} yaşında` : 'Yaş belirtilmemiş'} · {meds.length} ilaç
          </Text>
          {patient.notes ? (
            <View style={styles.notesRow}>
              <Ionicons name="create-outline" size={15} color={colors.textMuted} style={{ marginTop: 2 }} />
              <Text style={styles.notes}>{patient.notes}</Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button
              title="Düzenle"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => router.push(`/hasta/duzenle?id=${id}`)}
            />
            <Button
              title="Sil"
              variant="danger"
              style={{ flex: 1 }}
              onPress={confirmDelete}
            />
          </View>
        </Card>

        {hasSchedule ? (
          <Card>
            <View style={styles.uyumHeader}>
              <Text style={styles.uyumTitle}>Uyum (son 30 gün)</Text>
              <Text style={styles.uyumRate}>
                {summary30.total > 0
                  ? `%${Math.round(summary30.rate * 100)}`
                  : '—'}
              </Text>
            </View>
            <Text style={styles.uyumSub}>
              {summary30.taken} alındı · {summary30.skipped} atlandı ·{' '}
              {summary30.missed} kaçırıldı
            </Text>
            <Button
              title="Uyum geçmişi"
              icon="stats-chart-outline"
              variant="secondary"
              onPress={() => router.push(`/uyum?patientId=${id}`)}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        ) : null}

        {todayDoses.length > 0 ? (
          <View style={styles.todayBlock}>
            <Text style={styles.todayLabel}>Bugün — dozlar</Text>
            <DoseList doses={todayDoses} dayKey={todayK} onSet={setDoseStatus} />
          </View>
        ) : null}

        <View style={styles.medHeader}>
          <Text style={styles.medTitle}>İlaçlar</Text>
          {meds.length > 0 ? (
            <Button
              title="Listeyi Paylaş"
              icon="share-outline"
              variant="secondary"
              onPress={onShare}
              style={styles.shareBtn}
            />
          ) : null}
        </View>

        {meds.length === 0 ? (
          <EmptyState
            icon="medkit-outline"
            title="İlaç eklenmemiş"
            subtitle="Bu hastanın ilaçlarını ekleyin; uygulama ne zaman biteceğini takip etsin."
          />
        ) : (
          meds.map((med) => (
            <MedicationCard
              key={med.id}
              med={med}
              warnDays={warnDays}
              onPress={() => router.push(`/ilac/duzenle?id=${med.id}&patientId=${id}`)}
              onRefill={() => router.push(`/ilac/yenile?id=${med.id}`)}
            />
          ))
        )}

        <Button
          title="Karekod ile İlaç Ekle"
          icon="qr-code-outline"
          onPress={() => router.push(`/ilac/tara?patientId=${id}`)}
          style={{ marginTop: spacing.md }}
        />
        <Button
          title="Elle İlaç Ekle"
          icon="add"
          variant="secondary"
          onPress={() => router.push(`/ilac/duzenle?patientId=${id}`)}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg },
  name: { fontSize: fontSize.xxl, fontWeight: '900', color: colors.text },
  sub: { fontSize: fontSize.md, color: colors.textMuted, marginTop: 4 },
  notesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.md,
    backgroundColor: colors.bg,
    padding: spacing.md,
    borderRadius: 10,
  },
  notes: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  uyumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  uyumTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  uyumRate: { fontSize: fontSize.xxl, fontWeight: '900', color: colors.primary },
  uyumSub: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  todayBlock: { marginTop: spacing.md, marginBottom: spacing.sm },
  todayLabel: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  medHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  medTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  shareBtn: { paddingHorizontal: spacing.md, minHeight: 44 },
});
