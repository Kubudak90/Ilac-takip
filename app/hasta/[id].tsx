import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useData } from '@/store/DataContext';
import { colors, fontSize, spacing } from '@/theme';
import { Button, Card, EmptyState, Loading } from '@/components/ui';
import { MedicationCard } from '@/components/MedicationCard';

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, getPatient, medsForPatient, deletePatient } = useData();
  const router = useRouter();
  const warnDays = data.settings.warnDaysBefore;

  if (loading) return <Loading />;
  const patient = getPatient(id);

  if (!patient) {
    return (
      <View style={styles.center}>
        <EmptyState emoji="🔍" title="Hasta bulunamadı" />
      </View>
    );
  }

  const meds = medsForPatient(id);
  const age = patient.birthYear
    ? new Date().getFullYear() - patient.birthYear
    : undefined;

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
          {patient.notes ? <Text style={styles.notes}>📝 {patient.notes}</Text> : null}
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

        <View style={styles.medHeader}>
          <Text style={styles.medTitle}>İlaçlar</Text>
        </View>

        {meds.length === 0 ? (
          <EmptyState
            emoji="💊"
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
          title="📷 Karekod ile İlaç Ekle"
          onPress={() => router.push(`/ilac/tara?patientId=${id}`)}
          style={{ marginTop: spacing.md }}
        />
        <Button
          title="+ Elle İlaç Ekle"
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
  notes: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textMuted,
    backgroundColor: colors.bg,
    padding: spacing.md,
    borderRadius: 10,
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  medHeader: { marginTop: spacing.xl, marginBottom: spacing.md },
  medTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
});
