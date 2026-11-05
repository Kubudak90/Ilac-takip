import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useData } from '@/store/DataContext';
import { colors, fontSize, radius, spacing } from '@/theme';
import {
  AvatarBadge,
  Button,
  Card,
  EmptyState,
  Loading,
  Pill,
  ProgressBar,
  SearchBar,
} from '@/components/ui';
import { MedicationCard } from '@/components/MedicationCard';
import { DoseList } from '@/components/DoseList';
import { isDepleted, mostUrgentForMedication } from '@/utils/status';
import {
  ScheduledDose,
  adherenceSummary,
  indexLog,
  lastNDayKeys,
  scheduledDosesForDate,
} from '@/utils/adherence';
import { isPatientSnoozed } from '@/utils/notificationPlan';
import { scheduleSnoozedDoseNotification } from '@/utils/notifications';
import { buildPatientReport, buildPharmacyRenewalList } from '@/utils/report';
import { formatTR, parseISO, todayKey } from '@/utils/date';

type MedFilter = 'all' | 'urgent' | 'report' | 'prn';
type MedSort = 'urgency' | 'name';

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    data,
    loading,
    getPatient,
    medsForPatient,
    deletePatient,
    snoozePatient,
    setDoseStatus,
    takePrnDose,
    undoLastDelete,
  } = useData();
  const router = useRouter();
  const warnDays = data.settings.warnDaysBefore;
  const logByKey = useMemo(() => indexLog(data.doseLog), [data.doseLog]);

  const [medQuery, setMedQuery] = useState('');
  const [medFilter, setMedFilter] = useState<MedFilter>('all');
  const [medSort, setMedSort] = useState<MedSort>('urgency');

  const allMeds = useMemo(() => medsForPatient(id), [medsForPatient, id]);

  const filteredMeds = useMemo(() => {
    const q = medQuery.trim().toLocaleLowerCase('tr');
    const filtered = allMeds.filter((m) => {
      if (medFilter === 'report' && !m.hasReport) return false;
      if (medFilter === 'prn' && m.scheduleType !== 'prn') return false;
      if (medFilter === 'urgent') {
        const u = mostUrgentForMedication(m, warnDays);
        const urgent = isDepleted(m) || (u !== null && u.level !== 'ok');
        if (!urgent) return false;
      }
      if (!q) return true;
      return (
        m.name.toLocaleLowerCase('tr').includes(q) ||
        (m.notes ?? '').toLocaleLowerCase('tr').includes(q) ||
        (m.barcode ?? '').includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      if (medSort === 'name') {
        return a.name.localeCompare(b.name, 'tr');
      }
      const depA = isDepleted(a) ? -10000 : 0;
      const depB = isDepleted(b) ? -10000 : 0;
      const ua = mostUrgentForMedication(a, warnDays);
      const ub = mostUrgentForMedication(b, warnDays);
      return (depA + (ua?.daysLeft ?? Infinity)) - (depB + (ub?.daysLeft ?? Infinity));
    });
  }, [allMeds, medQuery, medFilter, medSort, warnDays]);

  if (loading) return <Loading />;
  const patient = getPatient(id);

  if (!patient) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <EmptyState icon="search-outline" title="Hasta bulunamadı" />
      </View>
    );
  }

  const age = patient.birthYear
    ? new Date().getFullYear() - patient.birthYear
    : undefined;
  const snoozed = isPatientSnoozed(patient);
  const patientDoseLog = data.doseLog.filter((e) => e.patientId === id);

  // Uyum: bugünün dozları + son 30 gün özeti (yalnız doz saati olan ilaçlar).
  const todayK = todayKey();
  const todayDoses = scheduledDosesForDate(allMeds, logByKey, todayK, todayK);
  const summary30 = adherenceSummary(allMeds, logByKey, lastNDayKeys(30), todayK);
  const hasSchedule = allMeds.some(
    (m) => (m.scheduleType ?? 'daily') !== 'prn' && m.doseTimes && m.doseTimes.length > 0,
  );

  async function handleSnoozeDose(dose: ScheduledDose, minutes: number) {
    const ok = await scheduleSnoozedDoseNotification({
      medicationId: dose.med.id,
      medName: dose.med.name,
      patientId: id,
      patientName: patient?.fullName,
      minutes,
      hideSensitive: data.settings.hideSensitiveNotifications,
    });
    if (ok) {
      Alert.alert(
        'Ertelendi',
        `${dose.med.name} için ${minutes} dakika sonra hatırlatma gönderilecek.`,
      );
    } else {
      Alert.alert(
        'Bildirim kurulamadı',
        'Hatırlatma kurmak için bildirim izninin açık olduğundan emin olun.',
      );
    }
  }

  function onAskSnoozePatient() {
    if (snoozed) {
      Alert.alert(
        'Bildirim ertelemesi aktif',
        `${patient!.fullName} için bildirimler şu an ertelenmiş durumda. Ertelemeyi kaldırmak veya süreyi değiştirmek ister misiniz?`,
        [
          {
            text: 'Ertelemeyi Kaldır',
            onPress: () => snoozePatient(id, null),
          },
          {
            text: 'Yarına Kadar (24 Saat)',
            onPress: () => snoozePatient(id, 24),
          },
          {
            text: '3 Gün Ertele',
            onPress: () => snoozePatient(id, 72),
          },
          { text: 'Vazgeç', style: 'cancel' },
        ],
      );
      return;
    }

    Alert.alert(
      'Hasta Bildirimlerini Ertele',
      `${patient!.fullName} için tüm ilaç/stok/rapor bildirimleri geçici olarak ne kadar süreyle ertelensin?`,
      [
        { text: '3 Saat Ertele', onPress: () => snoozePatient(id, 3) },
        { text: 'Yarına Kadar (24 Saat)', onPress: () => snoozePatient(id, 24) },
        { text: '3 Gün Ertele', onPress: () => snoozePatient(id, 72) },
        { text: '1 Hafta Ertele', onPress: () => snoozePatient(id, 168) },
        { text: 'Vazgeç', style: 'cancel' },
      ],
    );
  }

  function onShare() {
    Alert.alert(
      'Doktor / Eczane Özeti Paylaş',
      'Hangi listeyi paylaşmak istersiniz? (Hasta adı ve ilaç bilgilerini düz metin olarak paylaşır.)',
      [
        {
          text: 'Tüm İlaçlar (Doktor / Eczane Özeti)',
          onPress: async () => {
            try {
              await Share.share({
                title: `${patient!.fullName} — Doktor / Eczane İlaç Özeti`,
                message: buildPatientReport(
                  patient!,
                  allMeds,
                  warnDays,
                  patientDoseLog,
                ),
              });
            } catch {
              Alert.alert('Paylaşılamadı', 'Liste paylaşılırken bir sorun oluştu.');
            }
          },
        },
        {
          text: 'Yalnızca Yenilenecek İlaç & Raporlar',
          onPress: async () => {
            try {
              await Share.share({
                title: `${patient!.fullName} — Reçete Yenileme Listesi`,
                message: buildPharmacyRenewalList([patient!], allMeds, warnDays),
              });
            } catch {
              Alert.alert('Paylaşılamadı', 'Liste paylaşılırken bir sorun oluştu.');
            }
          },
        },
        { text: 'Vazgeç', style: 'cancel' },
      ],
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Hastayı sil',
      `${patient!.fullName} ve tüm ilaç kayıtları silinsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            deletePatient(id);
            Alert.alert('Silindi', `${patient!.fullName} silindi.`, [
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
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: patient.fullName }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.bg }]}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      >
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AvatarBadge name={patient.fullName} size={56} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text
                style={[
                  styles.name,
                  { color: colors.text, fontSize: fontSize.xxl },
                ]}
              >
                {patient.fullName}
              </Text>
              <Text
                style={[
                  styles.sub,
                  { color: colors.textMuted, fontSize: fontSize.md },
                ]}
              >
                {age ? `${age} yaşında` : 'Yaş belirtilmemiş'} · {allMeds.length} ilaç
              </Text>
            </View>
          </View>

          {patient.muteNotifications ? (
            <View style={{ marginTop: spacing.sm }}>
              <Pill
                icon="notifications-off-outline"
                text="Bildirimler kalıcı olarak susturulmuş"
                color={colors.textMuted}
                bg={colors.bg}
              />
            </View>
          ) : snoozed && patient.snoozeUntil ? (
            <Pressable onPress={onAskSnoozePatient} style={{ marginTop: spacing.sm }}>
              <Pill
                icon="alarm-outline"
                text={`Bildirimler ertelendi (${formatTR(parseISO(patient.snoozeUntil))} ${String(parseISO(patient.snoozeUntil).getHours()).padStart(2, '0')}:${String(parseISO(patient.snoozeUntil).getMinutes()).padStart(2, '0')}) · Dokun ve yönet`}
                color={colors.caution}
                bg={colors.cautionBg}
              />
            </Pressable>
          ) : null}

          {patient.notes ? (
            <View style={[styles.notesRow, { backgroundColor: colors.bg }]}>
              <Ionicons
                name="create-outline"
                size={15}
                color={colors.textMuted}
                style={{ marginTop: 2 }}
              />
              <Text
                style={[
                  styles.notes,
                  { color: colors.textMuted, fontSize: fontSize.md },
                ]}
              >
                {patient.notes}
              </Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button
              title="Düzenle"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => router.push(`/hasta/duzenle?id=${id}`)}
            />
            {!patient.muteNotifications ? (
              <Button
                title={snoozed ? 'Erteleme' : 'Ertele'}
                icon="alarm-outline"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={onAskSnoozePatient}
              />
            ) : null}
            <Button
              title="Sil"
              variant="danger"
              style={{ flex: 0.8 }}
              onPress={confirmDelete}
            />
          </View>
        </Card>

        {hasSchedule ? (
          <Card>
            <View style={styles.uyumHeader}>
              <Text
                style={[
                  styles.uyumTitle,
                  { color: colors.text, fontSize: fontSize.lg },
                ]}
              >
                Uyum (son 30 gün)
              </Text>
              <Text
                style={[
                  styles.uyumRate,
                  { color: colors.primary, fontSize: fontSize.xxl },
                ]}
              >
                {summary30.total > 0
                  ? `%${Math.round(summary30.rate * 100)}`
                  : '—'}
              </Text>
            </View>
            {summary30.total > 0 ? (
              <View style={{ marginVertical: spacing.sm }}>
                <ProgressBar
                  progress={summary30.rate}
                  color={
                    summary30.rate >= 0.85
                      ? colors.ok
                      : summary30.rate >= 0.65
                        ? colors.warning
                        : colors.danger
                  }
                  height={10}
                />
              </View>
            ) : null}
            <Text
              style={[
                styles.uyumSub,
                { color: colors.textMuted, fontSize: fontSize.sm },
              ]}
            >
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
            <Text
              style={[
                styles.todayLabel,
                { color: colors.text, fontSize: fontSize.lg },
              ]}
            >
              Bugün — dozlar
            </Text>
            <DoseList
              doses={todayDoses}
              dayKey={todayK}
              onSet={setDoseStatus}
              onSnooze={handleSnoozeDose}
            />
          </View>
        ) : null}

        <View style={styles.medHeader}>
          <Text
            style={[
              styles.medTitle,
              { color: colors.text, fontSize: fontSize.xl },
            ]}
          >
            İlaçlar ({allMeds.length})
          </Text>
          {allMeds.length > 0 ? (
            <Button
              title="Özeti Paylaş"
              icon="share-outline"
              variant="secondary"
              onPress={onShare}
              style={styles.shareBtn}
            />
          ) : null}
        </View>

        {allMeds.length > 1 ? (
          <>
            <SearchBar
              value={medQuery}
              onChangeText={setMedQuery}
              placeholder="İlaç adı, not veya barkod ara…"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              style={{ marginBottom: spacing.md }}
            >
              <Chip
                label="Tümü"
                active={medFilter === 'all'}
                onPress={() => setMedFilter('all')}
              />
              <Chip
                label="Acil / Azalan"
                active={medFilter === 'urgent'}
                onPress={() => setMedFilter('urgent')}
              />
              <Chip
                label="Raporlu"
                active={medFilter === 'report'}
                onPress={() => setMedFilter('report')}
              />
              <Chip
                label="İhtiyaç Halinde"
                active={medFilter === 'prn'}
                onPress={() => setMedFilter('prn')}
              />
              <Chip
                label={medSort === 'urgency' ? 'Sıra: Aciliyet' : 'Sıra: A-Z'}
                active={medSort === 'name'}
                onPress={() =>
                  setMedSort((s) => (s === 'urgency' ? 'name' : 'urgency'))
                }
              />
            </ScrollView>
          </>
        ) : null}

        {allMeds.length === 0 ? (
          <EmptyState
            icon="medkit-outline"
            title="İlaç eklenmemiş"
            subtitle="Bu hastanın ilaçlarını ekleyin; uygulama ne zaman biteceğini takip etsin."
          />
        ) : filteredMeds.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="Eşleşen ilaç bulunamadı"
            subtitle="Arama metnini veya filtreyi temizlemeyi deneyin."
          />
        ) : (
          filteredMeds.map((med) => (
            <MedicationCard
              key={med.id}
              med={med}
              warnDays={warnDays}
              onPress={() => router.push(`/ilac/duzenle?id=${med.id}&patientId=${id}`)}
              onRefill={() => router.push(`/ilac/yenile?id=${med.id}`)}
              onTakePrn={() => {
                takePrnDose(med.id);
                Alert.alert(
                  'Kaydedildi',
                  `${med.name} için ihtiyaç dozu kaydedildi ve stoktan düşüldü.`,
                );
              }}
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

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        active
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text
        style={[
          styles.filterChipText,
          {
            color: active ? colors.white : colors.text,
            fontSize: fontSize.sm,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
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
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  filterChipText: { fontWeight: '700' },
});

