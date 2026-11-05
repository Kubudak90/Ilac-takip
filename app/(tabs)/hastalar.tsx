import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/store/DataContext';
import { isDepleted, worstLevelForMeds } from '@/utils/status';
import { isPatientSnoozed } from '@/utils/notificationPlan';
import { colors, fontSize, radius, spacing, StatusLevel } from '@/theme';
import {
  AvatarBadge,
  Button,
  Card,
  EmptyState,
  Loading,
  Pill,
  SearchBar,
  StatusBadge,
} from '@/components/ui';

const LEVEL_LABEL: Record<StatusLevel, string> = {
  danger: 'Acil işlem',
  warning: 'Yakında',
  caution: 'Takipte',
  ok: 'Sorun yok',
};

const LEVEL_ORDER: Record<StatusLevel, number> = {
  danger: 0,
  warning: 1,
  caution: 2,
  ok: 3,
};

type PatientFilter = 'all' | 'urgent' | 'muted';

export default function PatientsScreen() {
  const { data, loading, medsForPatient } = useData();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PatientFilter>('all');

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const now = new Date();
    return data.patients
      .map((p) => {
        const meds = medsForPatient(p.id);
        const hasDepleted = meds.some(isDepleted);
        const level: StatusLevel = hasDepleted
          ? 'danger'
          : worstLevelForMeds(meds, data.settings.warnDaysBefore);
        const snoozed = isPatientSnoozed(p, now);
        const matchedMeds = q
          ? meds.filter((m) => m.name.toLocaleLowerCase('tr').includes(q))
          : [];
        return { p, meds, level, snoozed, matchedMeds };
      })
      .filter(({ p, level, snoozed, matchedMeds }) => {
        if (filter === 'urgent' && level !== 'danger' && level !== 'warning') {
          return false;
        }
        if (filter === 'muted' && !p.muteNotifications && !snoozed) {
          return false;
        }
        if (!q) return true;
        const nameMatch = p.fullName.toLocaleLowerCase('tr').includes(q);
        const notesMatch = (p.notes ?? '').toLocaleLowerCase('tr').includes(q);
        return nameMatch || notesMatch || matchedMeds.length > 0;
      })
      .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  }, [data.patients, data.settings.warnDaysBefore, medsForPatient, query, filter]);

  if (loading) return <Loading />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
      >
        {data.patients.length > 0 ? (
          <>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Hasta adı, tanı notu veya ilaç adı ara…"
            />
            <View style={styles.filterRow}>
              <FilterChip
                label="Tümü"
                active={filter === 'all'}
                onPress={() => setFilter('all')}
              />
              <FilterChip
                label="Acil / Yakında"
                active={filter === 'urgent'}
                onPress={() => setFilter('urgent')}
              />
              <FilterChip
                label="Susturulmuş / Ertelenmiş"
                active={filter === 'muted'}
                onPress={() => setFilter('muted')}
              />
            </View>
          </>
        ) : null}

        {data.patients.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="Hasta listeniz boş"
            subtitle="Takip etmek istediğiniz kişiyi ekleyin (örn. anneniz, babanız). Ardından ilaçlarını ve raporlarını girin."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="Eşleşen hasta bulunamadı"
            subtitle="Arama terimini veya seçili filtreyi değiştirmeyi deneyin."
          />
        ) : (
          rows.map(({ p, meds, level, snoozed, matchedMeds }) => {
            const age = p.birthYear
              ? new Date().getFullYear() - p.birthYear
              : undefined;
            return (
              <Card key={p.id} onPress={() => router.push(`/hasta/${p.id}`)}>
                <View style={styles.row}>
                  <AvatarBadge name={p.fullName} size={46} />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text
                      style={[
                        styles.name,
                        { color: colors.text, fontSize: fontSize.xl },
                      ]}
                    >
                      {p.fullName}
                    </Text>
                    <Text
                      style={[
                        styles.sub,
                        { color: colors.textMuted, fontSize: fontSize.md },
                      ]}
                    >
                      {age ? `${age} yaşında · ` : ''}
                      {meds.length} ilaç
                    </Text>
                  </View>
                  <Text style={[styles.chevron, { color: colors.textLight }]}>
                    ›
                  </Text>
                </View>

                {matchedMeds.length > 0 ? (
                  <Text
                    style={[
                      styles.matchedText,
                      { color: colors.primary, fontSize: fontSize.sm },
                    ]}
                  >
                    Eşleşen ilaç: {matchedMeds.map((m) => m.name).join(', ')}
                  </Text>
                ) : null}

                <View style={styles.badgesRow}>
                  {meds.length > 0 ? (
                    <StatusBadge level={level} label={LEVEL_LABEL[level]} />
                  ) : (
                    <Text
                      style={[
                        styles.noMed,
                        { color: colors.textLight, fontSize: fontSize.sm },
                      ]}
                    >
                      Henüz ilaç eklenmemiş
                    </Text>
                  )}
                  {p.muteNotifications ? (
                    <Pill
                      icon="notifications-off-outline"
                      text="Bildirimler kapalı"
                      color={colors.textMuted}
                      bg={colors.bg}
                    />
                  ) : snoozed ? (
                    <Pill
                      icon="alarm-outline"
                      text="Bildirimler ertelendi"
                      color={colors.caution}
                      bg={colors.cautionBg}
                    />
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      <View
        style={[
          styles.fabWrap,
          {
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
          },
        ]}
      >
        <Button
          title="+ Yeni Hasta Ekle"
          onPress={() => router.push('/hasta/duzenle')}
        />
      </View>
    </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  filterChipText: { fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  sub: { fontSize: fontSize.md, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 32, color: colors.textLight, fontWeight: '300' },
  matchedText: { fontWeight: '700', marginTop: spacing.xs },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  noMed: { fontSize: fontSize.sm, color: colors.textLight, fontStyle: 'italic' },
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

