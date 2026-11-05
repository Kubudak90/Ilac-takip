import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/store/DataContext';
import { buildUrgencyList, isDepleted, UrgencyItem } from '@/utils/status';
import { ScheduledDose, indexLog, scheduledDosesForDate } from '@/utils/adherence';
import { scheduleSnoozedDoseNotification } from '@/utils/notifications';
import { buildPharmacyRenewalList } from '@/utils/report';
import { formatTR, humanDays, todayKey } from '@/utils/date';
import { colors, fontSize, radius, spacing, statusBg, statusColor } from '@/theme';
import { Card, EmptyState, Loading, ProgressBar, StatusBadge, Button } from '@/components/ui';
import { DoseList } from '@/components/DoseList';

type KindFilter = 'all' | 'stock' | 'report' | 'expiry';

export default function DashboardScreen() {
  const {
    data,
    loading,
    loadFailed,
    saveFailed,
    retrySave,
    notificationsGranted,
    notifDropped,
    getPatient,
    setDoseStatus,
  } = useData();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedPatientId, setSelectedPatientId] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');

  // Seçili hastaya göre ilaçları süz
  const filteredMeds = useMemo(
    () =>
      selectedPatientId === 'all'
        ? data.medications
        : data.medications.filter((m) => m.patientId === selectedPatientId),
    [data.medications, selectedPatientId],
  );

  // Stoğu tükenmiş (takip edilen) ilaçlar — en üstte ayrı, eyleme dönük kategori.
  const depletedMeds = useMemo(
    () => filteredMeds.filter(isDepleted),
    [filteredMeds],
  );
  const allItems = useMemo(() => {
    const depletedIds = new Set(depletedMeds.map((m) => m.id));
    // Tükenen stok kalemlerini "Dikkat gerekenler"den çıkar (Tükendi'de gösterilir).
    return buildUrgencyList(filteredMeds, data.settings.warnDaysBefore).filter(
      (it) => !(it.kind === 'stock' && depletedIds.has(it.medication.id)),
    );
  }, [filteredMeds, data.settings.warnDaysBefore, depletedMeds]);

  const items = useMemo(
    () =>
      kindFilter === 'all'
        ? allItems
        : allItems.filter((it) => it.kind === kindFilter),
    [allItems, kindFilter],
  );

  // Bugün alınacak dozlar (yalnızca doz saati tanımlı ve bugün aktif ilaçlar).
  const todayK = todayKey();
  const todayDoses = useMemo(() => {
    const logByKey = indexLog(data.doseLog);
    return scheduledDosesForDate(filteredMeds, logByKey, todayK, todayK);
  }, [filteredMeds, data.doseLog, todayK]);
  const takenToday = todayDoses.filter((d) => d.status === 'taken').length;
  const patientsById = useMemo(
    () => new Map(data.patients.map((p) => [p.id, p.fullName])),
    [data.patients],
  );

  const counts = useMemo(() => {
    const c = { danger: 0, warning: 0, caution: 0, ok: 0 };
    for (const i of items) c[i.level]++;
    return c;
  }, [items]);

  // Sadece dikkat gereken (ok olmayan) öğeler önce; hepsi sıralı zaten
  const attention = items.filter((i) => i.level !== 'ok');
  const okItems = items.filter((i) => i.level === 'ok');
  const UPCOMING_LIMIT = 10;
  const upcoming = okItems.slice(0, UPCOMING_LIMIT);
  const hiddenCount = okItems.length - upcoming.length;

  async function handleSnoozeDose(dose: ScheduledDose, minutes: number) {
    const ok = await scheduleSnoozedDoseNotification({
      medicationId: dose.med.id,
      medName: dose.med.name,
      patientId: dose.med.patientId,
      patientName: patientsById.get(dose.med.patientId),
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

  function handleShareRenewalList() {
    const targetPatients =
      selectedPatientId === 'all'
        ? data.patients
        : data.patients.filter((p) => p.id === selectedPatientId);
    const text = buildPharmacyRenewalList(
      targetPatients,
      filteredMeds,
      data.settings.warnDaysBefore,
    );
    Alert.alert(
      'Reçete / Eczane Listesi Paylaş',
      'Biten veya yakında bitecek ilaç ve raporların listesi düz metin olarak paylaşılacak.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Paylaş',
          onPress: async () => {
            try {
              await Share.share({
                title: 'Reçete / Eczane Yenileme Listesi',
                message: text,
              });
            } catch {
              Alert.alert('Paylaşılamadı', 'Liste paylaşılırken bir sorun oluştu.');
            }
          },
        },
      ],
    );
  }

  if (loading) return <Loading />;

  // Depo okunamadı/bozuktu: kurtarılabilir veriyi ezmemek için kayıt durduruldu.
  if (loadFailed) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <EmptyState
          icon="warning-outline"
          title="Verilere şu an erişilemedi"
          subtitle="Kayıtlarınız okunamadı. Yanlışlıkla üzerine yazmamak için kayıt geçici olarak durduruldu. Lütfen uygulamayı kapatıp yeniden açın. Sorun sürerse son yedeğinizden geri yükleyin."
        />
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          <Button
            title="Yedekle / Geri Yükle"
            icon="cloud-download-outline"
            onPress={() => router.push('/yedek')}
          />
        </View>
      </View>
    );
  }

  if (data.patients.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <EmptyState
          icon="medkit-outline"
          title="Henüz hasta eklenmedi"
          subtitle="Başlamak için “Hastalar” sekmesinden bir hasta ekleyin ve ilaçlarını girin. Uygulama ilaç ve raporların ne zaman biteceğini sizin için takip etsin."
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={{
        padding: spacing.lg,
        paddingBottom: insets.bottom + spacing.xl,
      }}
    >
      {/* Bildirim izni ayar "açık" ama sistemde kapalıysa: sessiz arıza uyarısı */}
      {data.settings.notificationsEnabled && !notificationsGranted ? (
        <Pressable
          onPress={() => Linking.openSettings()}
          style={[styles.permBanner, { backgroundColor: colors.dangerBg }]}
          accessibilityRole="button"
          accessibilityLabel="Bildirim izni kapalı. Hatırlatmalar gelmiyor. Açmak için telefon ayarlarını açın."
        >
          <Ionicons name="notifications-off-outline" size={22} color={colors.danger} />
          <Text
            style={[
              styles.permBannerText,
              { color: colors.danger, fontSize: fontSize.sm },
            ]}
          >
            Bildirim izni kapalı — hatırlatmalar gelmiyor. Açmak için dokunun.
          </Text>
        </Pressable>
      ) : null}

      {saveFailed ? (
        <Pressable
          onPress={() => {
            void retrySave();
          }}
          style={[styles.permBanner, { backgroundColor: colors.dangerBg }]}
          accessibilityRole="button"
          accessibilityLabel="Kayıt başarısız. Tekrar denemek için dokunun."
        >
          <Ionicons name="save-outline" size={22} color={colors.danger} />
          <Text
            style={[
              styles.permBannerText,
              { color: colors.danger, fontSize: fontSize.sm },
            ]}
          >
            Son değişiklikler kaydedilemedi. Tekrar denemek için dokunun veya
            yedek alın.
          </Text>
        </Pressable>
      ) : null}

      {/* Cihaz/bütçe sınırı: bazı hatırlatmalar planlanamadı */}
      {notifDropped > 0 ? (
        <View style={[styles.dropBanner, { backgroundColor: colors.warningBg }]}>
          <Ionicons name="warning-outline" size={20} color={colors.warning} />
          <Text
            style={[
              styles.dropBannerText,
              { color: colors.warning, fontSize: fontSize.sm },
            ]}
          >
            {notifDropped} hatırlatma cihaz sınırı nedeniyle planlanamadı. İlaç
            saati sayısını azaltmayı veya uyarı gününü düşürmeyi deneyin.
          </Text>
        </View>
      ) : null}

      {/* Çok hastalı filtre çipleri */}
      {data.patients.length > 1 ? (
        <View style={styles.filterGroup}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <FilterChip
              label="Tüm Hastalar"
              active={selectedPatientId === 'all'}
              onPress={() => setSelectedPatientId('all')}
            />
            {data.patients.map((p) => (
              <FilterChip
                key={p.id}
                label={p.fullName}
                active={selectedPatientId === p.id}
                onPress={() => setSelectedPatientId(p.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Tükenen ilaçlar — en acil eylem: hemen yenile */}
      {depletedMeds.length > 0 ? (
        <View style={styles.todaySection}>
          <View style={styles.headingRow}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text
              style={[
                styles.heading,
                { color: colors.danger, fontSize: fontSize.lg },
              ]}
            >
              Tükendi — hemen yenileyin ({depletedMeds.length})
            </Text>
          </View>
          {depletedMeds.map((m) => (
            <Card key={m.id} onPress={() => router.push(`/ilac/yenile?id=${m.id}`)}>
              <View style={styles.rowTop}>
                <Ionicons
                  name="medkit"
                  size={18}
                  color={colors.danger}
                  style={{ marginRight: 6, marginTop: 3 }}
                />
                <Text
                  style={[
                    styles.rowMed,
                    { color: colors.text, fontSize: fontSize.lg },
                  ]}
                  numberOfLines={2}
                >
                  {m.name}
                </Text>
              </View>
              <Text
                style={[
                  styles.rowPatient,
                  { color: colors.textMuted, fontSize: fontSize.md },
                ]}
              >
                {getPatient(m.patientId)?.fullName ?? 'Hasta'}
              </Text>
              <StatusBadge level="danger" label="Stok bitti · yenile" />
            </Card>
          ))}
        </View>
      ) : null}

      {/* Bugün alınacak dozlar — günlük asıl eylem */}
      {todayDoses.length > 0 ? (
        <View style={styles.todaySection}>
          <Card style={{ marginBottom: spacing.md }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing.sm,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="time" size={20} color={colors.primary} />
                <Text
                  style={[
                    styles.heading,
                    { color: colors.text, fontSize: fontSize.lg },
                  ]}
                >
                  Bugünkü Doz İlerlemesi
                </Text>
              </View>
              <Text
                style={{
                  color: colors.primary,
                  fontSize: fontSize.lg,
                  fontWeight: '900',
                }}
              >
                {takenToday}/{todayDoses.length}
              </Text>
            </View>
            <ProgressBar
              progress={todayDoses.length > 0 ? takenToday / todayDoses.length : 0}
              color={takenToday === todayDoses.length ? colors.ok : colors.primary}
              height={10}
            />
          </Card>
          <DoseList
            doses={todayDoses}
            dayKey={todayK}
            patientsById={patientsById}
            onSet={setDoseStatus}
            onSnooze={handleSnoozeDose}
          />
        </View>
      ) : null}

      {/* Kategori filtresi (Stok / Rapor / Son Kullanma) */}
      {allItems.length > 0 ? (
        <View style={styles.filterGroup}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <FilterChip
              label="Tümü"
              active={kindFilter === 'all'}
              onPress={() => setKindFilter('all')}
            />
            <FilterChip
              label="İlaç Stoğu"
              active={kindFilter === 'stock'}
              onPress={() => setKindFilter('stock')}
            />
            <FilterChip
              label="Rapor"
              active={kindFilter === 'report'}
              onPress={() => setKindFilter('report')}
            />
            <FilterChip
              label="Son Kullanma"
              active={kindFilter === 'expiry'}
              onPress={() => setKindFilter('expiry')}
            />
          </ScrollView>
        </View>
      ) : null}

      {/* Özet sayaçlar */}
      <View style={styles.summaryRow}>
        <SummaryBox count={counts.danger} label="Acil" level="danger" />
        <SummaryBox count={counts.warning} label="Yakında" level="warning" />
        <SummaryBox count={counts.caution} label="Takipte" level="caution" />
      </View>

      {/* Reçete / Eczane Listesi Paylaş düğmesi */}
      {depletedMeds.length > 0 || attention.length > 0 ? (
        <Button
          title="Reçete / Eczane Listesi Paylaş"
          icon="share-social-outline"
          variant="secondary"
          onPress={handleShareRenewalList}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      {attention.length > 0 ? (
        <>
          <View style={styles.headingRow}>
            <Ionicons name="alert-circle" size={20} color={colors.warning} />
            <Text
              style={[
                styles.heading,
                { color: colors.text, fontSize: fontSize.lg },
              ]}
            >
              Dikkat gerekenler
            </Text>
          </View>
          {attention.map((item) => (
            <UrgencyRow
              key={`${item.medication.id}-${item.kind}`}
              item={item}
              patientName={getPatient(item.medication.patientId)?.fullName ?? 'Hasta'}
              onPress={() => router.push(`/hasta/${item.medication.patientId}`)}
            />
          ))}
        </>
      ) : (
        <Card>
          <View style={styles.headingRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.ok} />
            <Text
              style={[
                styles.allGood,
                { color: colors.ok, fontSize: fontSize.lg },
              ]}
            >
              Şu an acil bir durum yok.
            </Text>
          </View>
          <Text
            style={[
              styles.allGoodSub,
              { color: colors.textMuted, fontSize: fontSize.md },
            ]}
          >
            Tüm ilaç ve raporlarda yeterli süre var. Yaklaşanları aşağıda
            görebilirsiniz.
          </Text>
        </Card>
      )}

      {upcoming.length > 0 ? (
        <>
          <View style={[styles.headingRow, { marginTop: spacing.lg }]}>
            <Ionicons name="calendar-outline" size={20} color={colors.text} />
            <Text
              style={[
                styles.heading,
                { color: colors.text, fontSize: fontSize.lg },
              ]}
            >
              Sıradaki bitişler
            </Text>
          </View>
          {upcoming.map((item) => (
            <UrgencyRow
              key={`${item.medication.id}-${item.kind}`}
              item={item}
              patientName={getPatient(item.medication.patientId)?.fullName ?? 'Hasta'}
              onPress={() => router.push(`/hasta/${item.medication.patientId}`)}
            />
          ))}
          {hiddenCount > 0 ? (
            <Text
              style={[
                styles.moreNote,
                { color: colors.textMuted, fontSize: fontSize.sm },
              ]}
            >
              + {hiddenCount} kayıt daha (hasta detayında görünür)
            </Text>
          ) : null}
        </>
      ) : null}

      {filteredMeds.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title="İlaç eklenmemiş"
          subtitle="Hastalarınıza ilaç ekleyince bitiş tarihleri burada listelenir."
        />
      ) : null}
    </ScrollView>
  );
}

function FilterChip({
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

function SummaryBox({
  count,
  label,
  level,
}: {
  count: number;
  label: string;
  level: 'danger' | 'warning' | 'caution';
}) {
  return (
    <View style={[styles.summaryBox, { backgroundColor: statusBg[level] }]}>
      <Text
        style={[
          styles.summaryCount,
          { color: statusColor[level], fontSize: fontSize.xxl },
        ]}
      >
        {count}
      </Text>
      <Text
        style={[
          styles.summaryLabel,
          { color: statusColor[level], fontSize: fontSize.sm },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function UrgencyRow({
  item,
  patientName,
  onPress,
}: {
  item: UrgencyItem;
  patientName: string;
  onPress: () => void;
}) {
  const kindIcon =
    item.kind === 'stock'
      ? 'medkit'
      : item.kind === 'report'
        ? 'document-text-outline'
        : 'cube-outline';
  const prefix =
    item.kind === 'stock'
      ? 'İlaç '
      : item.kind === 'report'
        ? 'Rapor '
        : 'Son kullanma ';
  return (
    <Card onPress={onPress}>
      <View style={styles.rowTop}>
        <Ionicons
          name={kindIcon}
          size={18}
          color={colors.text}
          style={{ marginRight: 6, marginTop: 3 }}
        />
        <Text
          style={[
            styles.rowMed,
            { color: colors.text, fontSize: fontSize.lg },
          ]}
          numberOfLines={2}
        >
          {item.medication.name}
        </Text>
      </View>
      <Text
        style={[
          styles.rowPatient,
          { color: colors.textMuted, fontSize: fontSize.md },
        ]}
      >
        {patientName}
      </Text>
      <View style={styles.rowBottom}>
        <StatusBadge level={item.level} label={prefix + humanDays(item.daysLeft)} />
        <Text
          style={[
            styles.rowDate,
            { color: colors.textMuted, fontSize: fontSize.sm },
          ]}
        >
          {formatTR(item.date)}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg },
  permBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerBg,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  permBannerText: {
    flex: 1,
    color: colors.danger,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  dropBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningBg,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  dropBannerText: {
    flex: 1,
    color: colors.warning,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  filterGroup: { marginBottom: spacing.md },
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  filterChipText: { fontWeight: '700' },
  todaySection: { marginBottom: spacing.xl },
  summaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  summaryBox: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  summaryCount: { fontSize: fontSize.xxl, fontWeight: '900' },
  summaryLabel: { fontSize: fontSize.sm, fontWeight: '700', marginTop: 2 },
  heading: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  allGood: { fontSize: fontSize.lg, fontWeight: '800', color: colors.ok },
  allGoodSub: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.xs },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start' },
  rowMed: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, flex: 1 },
  rowPatient: { fontSize: fontSize.md, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowDate: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600' },
  moreNote: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
});

