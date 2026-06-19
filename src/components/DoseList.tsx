// Bir gün için planlı dozların "Aldım / Atladım" listesi.
// Büyük dokunma alanları ve ekran okuyucu etiketleriyle (yaşlı/bakıcı erişim).

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScheduledDose } from '../utils/adherence';
import { formatDose } from '../utils/date';
import { colors, fontSize, radius, spacing } from '../theme';

export function DoseList({
  doses,
  dayKey,
  patientsById,
  onSet,
  readOnly,
}: {
  doses: ScheduledDose[];
  dayKey: string;
  /** Verilirse her satırda hasta adı gösterilir (çok-hastalı görünüm). */
  patientsById?: Map<string, string>;
  onSet: (
    medId: string,
    dayKey: string,
    time: string,
    status: 'taken' | 'skipped',
  ) => void;
  readOnly?: boolean;
}) {
  return (
    <View style={styles.list}>
      {doses.map((dose) => (
        <DoseRow
          key={dose.key}
          dose={dose}
          dayKey={dayKey}
          patientName={patientsById?.get(dose.med.patientId)}
          onSet={onSet}
          readOnly={readOnly}
        />
      ))}
    </View>
  );
}

function DoseRow({
  dose,
  dayKey,
  patientName,
  onSet,
  readOnly,
}: {
  dose: ScheduledDose;
  dayKey: string;
  patientName?: string;
  onSet: (
    medId: string,
    dayKey: string,
    time: string,
    status: 'taken' | 'skipped',
  ) => void;
  readOnly?: boolean;
}) {
  const { med, time, status, doseSize } = dose;
  const taken = status === 'taken';
  const skipped = status === 'skipped';
  const missed = status === 'missed';
  const statusWord = taken
    ? 'alındı'
    : skipped
      ? 'atlandı'
      : missed
        ? 'kaçırıldı'
        : 'bekliyor';
  const a11yBase = `${med.name}${time ? ` ${time}` : ''}, şu an ${statusWord}`;

  const subParts = [
    patientName,
    `${formatDose(doseSize)} adet`,
    missed ? 'kaçırıldı' : null,
  ].filter(Boolean);

  return (
    <View style={[styles.row, missed && styles.rowMissed]}>
      <View style={styles.timeBox}>
        <Text style={styles.time}>{time || '—'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.med} numberOfLines={2}>
          {med.name}
        </Text>
        <Text style={[styles.sub, missed && styles.subMissed]}>
          {subParts.join(' · ')}
        </Text>
      </View>
      {readOnly ? (
        <StatusTag taken={taken} skipped={skipped} missed={missed} />
      ) : (
        <View style={styles.actions}>
          <Pressable
            onPress={() => onSet(med.id, dayKey, time, 'taken')}
            style={[styles.btn, taken ? styles.btnTakenOn : styles.btnOff]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityState={{ selected: taken }}
            accessibilityLabel={`${a11yBase}. Aldım olarak işaretle.`}
          >
            <Ionicons
              name="checkmark"
              size={22}
              color={taken ? colors.white : colors.ok}
            />
          </Pressable>
          <Pressable
            onPress={() => onSet(med.id, dayKey, time, 'skipped')}
            style={[styles.btn, skipped ? styles.btnSkipOn : styles.btnOff]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityState={{ selected: skipped }}
            accessibilityLabel={`${a11yBase}. Atladım olarak işaretle.`}
          >
            <Ionicons
              name="close"
              size={22}
              color={skipped ? colors.white : colors.textMuted}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function StatusTag({
  taken,
  skipped,
  missed,
}: {
  taken: boolean;
  skipped: boolean;
  missed: boolean;
}) {
  const { label, color, bg } = taken
    ? { label: 'Alındı', color: colors.ok, bg: colors.okBg }
    : skipped
      ? { label: 'Atlandı', color: colors.caution, bg: colors.cautionBg }
      : missed
        ? { label: 'Kaçırıldı', color: colors.danger, bg: colors.dangerBg }
        : { label: 'Bekliyor', color: colors.textMuted, bg: colors.bg };
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowMissed: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  timeBox: {
    minWidth: 52,
    alignItems: 'center',
  },
  time: { fontSize: fontSize.lg, fontWeight: '800', color: colors.primaryDark },
  info: { flex: 1 },
  med: { fontSize: fontSize.md, fontWeight: '800', color: colors.text },
  sub: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  subMissed: { color: colors.danger, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  btnOff: { backgroundColor: colors.white, borderColor: colors.border },
  btnTakenOn: { backgroundColor: colors.ok, borderColor: colors.ok },
  btnSkipOn: { backgroundColor: colors.textMuted, borderColor: colors.textMuted },
  tag: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  tagText: { fontSize: fontSize.sm, fontWeight: '800' },
});
