import React, { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/store/DataContext';
import { buildUrgencyList, isDepleted, UrgencyItem } from '@/utils/status';
import { indexLog, scheduledDosesForDate } from '@/utils/adherence';
import { formatTR, humanDays, todayKey } from '@/utils/date';
import { colors, fontSize, spacing, statusBg, statusColor } from '@/theme';
import { Card, EmptyState, Loading, StatusBadge } from '@/components/ui';
import { DoseList } from '@/components/DoseList';

export default function DashboardScreen() {
  const { data, loading, loadFailed, notificationsGranted, notifDropped, getPatient, setDoseStatus } =
    useData();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Stoğu tükenmiş (takip edilen) ilaçlar — en üstte ayrı, eyleme dönük kategori.
  const depletedMeds = useMemo(
    () => data.medications.filter(isDepleted),
    [data.medications],
  );
  const items = useMemo(() => {
    const depletedIds = new Set(depletedMeds.map((m) => m.id));
    // Tükenen stok kalemlerini "Dikkat gerekenler"den çıkar (Tükendi'de gösterilir).
    return buildUrgencyList(data.medications, data.settings.warnDaysBefore).filter(
      (it) => !(it.kind === 'stock' && depletedIds.has(it.medication.id)),
    );
  }, [data.medications, data.settings.warnDaysBefore, depletedMeds]);

  // Bugün alınacak dozlar (yalnızca doz saati tanımlı ilaçlar).
  const todayK = todayKey();
  const todayDoses = useMemo(() => {
    const logByKey = indexLog(data.doseLog);
    return scheduledDosesForDate(data.medications, logByKey, todayK, todayK);
  }, [data.medications, data.doseLog, todayK]);
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

  if (loading) return <Loading />;

  // Depo okunamadı/bozuktu: kurtarılabilir veriyi ezmemek için kayıt durduruldu.
  // Yanıltıcı "hasta yok" boş durumu yerine net bir uyarı göster.
  if (loadFailed) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="warning-outline"
          title="Verilere şu an erişilemedi"
          subtitle="Kayıtlarınız okunamadı. Yanlışlıkla üzerine yazmamak için kayıt geçici olarak durduruldu. Lütfen uygulamayı kapatıp yeniden açın. Sorun sürerse Ayarlar → Yedekle / Geri Yükle ile son yedeğinizden geri yükleyin."
        />
      </View>
    );
  }

  if (data.patients.length === 0) {
    return (
      <View style={styles.center}>
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
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
    >
      {/* Bildirim izni ayar "açık" ama sistemde kapalıysa: sessiz arıza uyarısı */}
      {data.settings.notificationsEnabled && !notificationsGranted ? (
        <Pressable
          onPress={() => Linking.openSettings()}
          style={styles.permBanner}
          accessibilityRole="button"
          accessibilityLabel="Bildirim izni kapalı. Hatırlatmalar gelmiyor. Açmak için telefon ayarlarını açın."
        >
          <Ionicons name="notifications-off-outline" size={22} color={colors.danger} />
          <Text style={styles.permBannerText}>
            Bildirim izni kapalı — hatırlatmalar gelmiyor. Açmak için dokunun.
          </Text>
        </Pressable>
      ) : null}

      {/* Cihaz/bütçe sınırı: bazı hatırlatmalar planlanamadı (sessiz düşürme yerine uyar) */}
      {notifDropped > 0 ? (
        <View style={styles.dropBanner}>
          <Ionicons name="warning-outline" size={20} color={colors.warning} />
          <Text style={styles.dropBannerText}>
            {notifDropped} hatırlatma cihaz sınırı nedeniyle planlanamadı. İlaç
            saati sayısını azaltmayı veya uyarı gününü düşürmeyi deneyin.
          </Text>
        </View>
      ) : null}

      {/* Tükenen ilaçlar — en acil eylem: hemen yenile */}
      {depletedMeds.length > 0 ? (
        <View style={styles.todaySection}>
          <View style={styles.headingRow}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={[styles.heading, { color: colors.danger }]}>
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
                <Text style={styles.rowMed} numberOfLines={2}>
                  {m.name}
                </Text>
              </View>
              <Text style={styles.rowPatient}>
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
          <View style={styles.headingRow}>
            <Ionicons name="time" size={20} color={colors.primary} />
            <Text style={styles.heading}>
              Bugün — dozlar ({takenToday}/{todayDoses.length})
            </Text>
          </View>
          <DoseList
            doses={todayDoses}
            dayKey={todayK}
            patientsById={patientsById}
            onSet={setDoseStatus}
          />
        </View>
      ) : null}

      {/* Özet sayaçlar */}
      <View style={styles.summaryRow}>
        <SummaryBox count={counts.danger} label="Acil" level="danger" />
        <SummaryBox count={counts.warning} label="Yakında" level="warning" />
        <SummaryBox count={counts.caution} label="Takipte" level="caution" />
      </View>

      {attention.length > 0 ? (
        <>
          <View style={styles.headingRow}>
            <Ionicons name="alert-circle" size={20} color={colors.warning} />
            <Text style={styles.heading}>Dikkat gerekenler</Text>
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
            <Text style={styles.allGood}>Şu an acil bir durum yok.</Text>
          </View>
          <Text style={styles.allGoodSub}>
            Tüm ilaç ve raporlarda yeterli süre var. Yaklaşanları aşağıda
            görebilirsiniz.
          </Text>
        </Card>
      )}

      {upcoming.length > 0 ? (
        <>
          <View style={[styles.headingRow, { marginTop: spacing.lg }]}>
            <Ionicons name="calendar-outline" size={20} color={colors.text} />
            <Text style={styles.heading}>Sıradaki bitişler</Text>
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
            <Text style={styles.moreNote}>
              + {hiddenCount} kayıt daha (hasta detayında görünür)
            </Text>
          ) : null}
        </>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title="İlaç eklenmemiş"
          subtitle="Hastalarınıza ilaç ekleyince bitiş tarihleri burada listelenir."
        />
      ) : null}
    </ScrollView>
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
      <Text style={[styles.summaryCount, { color: statusColor[level] }]}>
        {count}
      </Text>
      <Text style={[styles.summaryLabel, { color: statusColor[level] }]}>
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
        <Text style={styles.rowMed} numberOfLines={2}>
          {item.medication.name}
        </Text>
      </View>
      <Text style={styles.rowPatient}>{patientName}</Text>
      <View style={styles.rowBottom}>
        <StatusBadge level={item.level} label={prefix + humanDays(item.daysLeft)} />
        <Text style={styles.rowDate}>{formatTR(item.date)}</Text>
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
