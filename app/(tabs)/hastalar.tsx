import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/store/DataContext';
import { worstLevelForMeds } from '@/utils/status';
import { colors, fontSize, spacing, StatusLevel } from '@/theme';
import { Button, Card, EmptyState, Loading, StatusBadge } from '@/components/ui';

const LEVEL_LABEL: Record<StatusLevel, string> = {
  danger: 'Acil işlem',
  warning: 'Yakında',
  caution: 'Takipte',
  ok: 'Sorun yok',
};

export default function PatientsScreen() {
  const { data, loading, medsForPatient } = useData();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
      >
        {data.patients.length === 0 ? (
          <EmptyState
            emoji="👥"
            title="Hasta listeniz boş"
            subtitle="Takip etmek istediğiniz kişiyi ekleyin (örn. anneniz, babanız). Ardından ilaçlarını ve raporlarını girin."
          />
        ) : (
          data.patients.map((p) => {
            const meds = medsForPatient(p.id);
            const level = worstLevelForMeds(meds, data.settings.warnDaysBefore);
            const age = p.birthYear
              ? new Date().getFullYear() - p.birthYear
              : undefined;
            return (
              <Card key={p.id} onPress={() => router.push(`/hasta/${p.id}`)}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{p.fullName}</Text>
                    <Text style={styles.sub}>
                      {age ? `${age} yaşında · ` : ''}
                      {meds.length} ilaç
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
                {meds.length > 0 ? (
                  <View style={{ marginTop: spacing.md }}>
                    <StatusBadge level={level} label={LEVEL_LABEL[level]} />
                  </View>
                ) : (
                  <Text style={styles.noMed}>Henüz ilaç eklenmemiş</Text>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.fabWrap, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title="+ Yeni Hasta Ekle"
          onPress={() => router.push('/hasta/duzenle')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  sub: { fontSize: fontSize.md, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 32, color: colors.textLight, fontWeight: '300' },
  noMed: { fontSize: fontSize.sm, color: colors.textLight, marginTop: spacing.sm, fontStyle: 'italic' },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
