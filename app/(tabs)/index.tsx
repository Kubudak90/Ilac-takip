import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/store/DataContext';
import { buildUrgencyList, UrgencyItem } from '@/utils/status';
import { formatTR, humanDays } from '@/utils/date';
import { colors, fontSize, spacing, statusBg, statusColor } from '@/theme';
import { Card, EmptyState, Loading, StatusBadge } from '@/components/ui';

export default function DashboardScreen() {
  const { data, loading, getPatient } = useData();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const items = useMemo(
    () => buildUrgencyList(data.medications, data.settings.warnDaysBefore),
    [data.medications, data.settings.warnDaysBefore],
  );

  const counts = useMemo(() => {
    const c = { danger: 0, warning: 0, caution: 0, ok: 0 };
    for (const i of items) c[i.level]++;
    return c;
  }, [items]);

  // Sadece dikkat gereken (ok olmayan) öğeler önce; hepsi sıralı zaten
  const attention = items.filter((i) => i.level !== 'ok');
  const upcoming = items.filter((i) => i.level === 'ok').slice(0, 10);

  if (loading) return <Loading />;

  if (data.patients.length === 0) {
    return (
      <View style={styles.center}>
        <EmptyState
          emoji="💊"
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
      {/* Özet sayaçlar */}
      <View style={styles.summaryRow}>
        <SummaryBox count={counts.danger} label="Acil" level="danger" />
        <SummaryBox count={counts.warning} label="Yakında" level="warning" />
        <SummaryBox count={counts.caution} label="Takipte" level="caution" />
      </View>

      {attention.length > 0 ? (
        <>
          <Text style={styles.heading}>⚠️ Dikkat gerekenler</Text>
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
          <Text style={styles.allGood}>✅ Şu an acil bir durum yok.</Text>
          <Text style={styles.allGoodSub}>
            Tüm ilaç ve raporlarda yeterli süre var. Yaklaşanları aşağıda
            görebilirsiniz.
          </Text>
        </Card>
      )}

      {upcoming.length > 0 ? (
        <>
          <Text style={[styles.heading, { marginTop: spacing.lg }]}>
            📅 Sıradaki bitişler
          </Text>
          {upcoming.map((item) => (
            <UrgencyRow
              key={`${item.medication.id}-${item.kind}`}
              item={item}
              patientName={getPatient(item.medication.patientId)?.fullName ?? 'Hasta'}
              onPress={() => router.push(`/hasta/${item.medication.patientId}`)}
            />
          ))}
        </>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          emoji="📋"
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
  return (
    <Card onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.rowMed} numberOfLines={1}>
          {item.kind === 'stock' ? '💊 ' : '📄 '}
          {item.medication.name}
        </Text>
      </View>
      <Text style={styles.rowPatient}>{patientName}</Text>
      <View style={styles.rowBottom}>
        <StatusBadge
          level={item.level}
          label={
            (item.kind === 'stock' ? 'İlaç ' : 'Rapor ') + humanDays(item.daysLeft)
          }
        />
        <Text style={styles.rowDate}>{formatTR(item.date)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg },
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
    marginBottom: spacing.md,
  },
  allGood: { fontSize: fontSize.lg, fontWeight: '800', color: colors.ok },
  allGoodSub: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.xs },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  rowMed: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, flex: 1 },
  rowPatient: { fontSize: fontSize.md, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowDate: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600' },
});
