// Bir gün için planlı dozların "Aldım / Atladım / Ertele" listesi.
// Büyük dokunma alanları ve ekran okuyucu etiketleriyle (yaşlı/bakıcı erişim).

import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScheduledDose, mealRelationLabel } from '../utils/adherence';
import { formatDose } from '../utils/date';
import { colors, fontSize, radius, spacing } from '../theme';

export function DoseList({
  doses,
  dayKey,
  patientsById,
  onSet,
  onSnooze,
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
  /** Bekleyen doz için erteleme (snooze) bildirimi kurar. */
  onSnooze?: (dose: ScheduledDose, minutes: number) => void;
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
          onSnooze={onSnooze}
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
  onSnooze,
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
  onSnooze?: (dose: ScheduledDose, minutes: number) => void;
  readOnly?: boolean;
}) {
  const { med, time, status, doseSize } = dose;
  const taken = status === 'taken';
  const skipped = status === 'skipped';
  const missed = status === 'missed';
  const pending = status === 'pending';
  const statusWord = taken
    ? 'alındı'
    : skipped
      ? 'atlandı'
      : missed
        ? 'kaçırıldı'
        : 'bekliyor';
  const a11yBase = `${med.name}${time ? ` ${time}` : ''}, şu an ${statusWord}`;
  const mealLabel = mealRelationLabel(med.mealRelation);

  const subParts = [
    patientName,
    `${formatDose(doseSize)} adet`,
    mealLabel,
    missed ? 'kaçırıldı' : null,
  ].filter(Boolean);

  function askSnooze() {
    if (!onSnooze) return;
    Alert.alert(
      'İlaç saatini ertele',
      `${med.name} (${time}) için ne zaman tekrar hatırlatma gönderilsin?`,
      [
        { text: '15 dakika sonra', onPress: () => onSnooze(dose, 15) },
        { text: '30 dakika sonra', onPress: () => onSnooze(dose, 30) },
        { text: '1 saat sonra', onPress: () => onSnooze(dose, 60) },
        { text: 'Vazgeç', style: 'cancel' },
      ],
    );
  }

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border },
        taken && { borderColor: colors.ok, backgroundColor: colors.okBg },
        missed && { borderColor: colors.danger, backgroundColor: colors.dangerBg },
      ]}
    >
      <View
        style={[
          styles.timeBox,
          {
            backgroundColor: taken
              ? colors.ok
              : missed
                ? colors.danger
                : colors.primaryLight,
          },
        ]}
      >
        <Ionicons
          name={taken ? 'checkmark-circle' : 'time-outline'}
          size={14}
          color={taken || missed ? colors.white : colors.primaryDark}
        />
        <Text
          style={[
            styles.time,
            {
              color: taken || missed ? colors.white : colors.primaryDark,
              fontSize: fontSize.md,
            },
          ]}
        >
          {time || '—'}
        </Text>
      </View>
      <View style={styles.info}>
        <Text
          style={[styles.med, { color: colors.text, fontSize: fontSize.md }]}
          numberOfLines={2}
        >
          {med.name}
        </Text>
        <Text
          style={[
            styles.sub,
            { color: colors.textMuted, fontSize: fontSize.sm },
            missed && { color: colors.danger, fontWeight: '700' },
          ]}
        >
          {subParts.join(' · ')}
        </Text>
      </View>
      {readOnly ? (
        <StatusTag taken={taken} skipped={skipped} missed={missed} />
      ) : (
        <View style={styles.actions}>
          {pending && onSnooze ? (
            <Pressable
              onPress={askSnooze}
              style={[
                styles.btn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  width: 42,
                },
              ]}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`${a11yBase}. Hatırlatmayı ertele.`}
            >
              <Ionicons
                name="alarm-outline"
                size={20}
                color={colors.primary}
              />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => onSet(med.id, dayKey, time, 'taken')}
            style={[
              styles.btn,
              taken
                ? { backgroundColor: colors.ok, borderColor: colors.ok }
                : { backgroundColor: colors.card, borderColor: colors.ok },
            ]}
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
            style={[
              styles.btn,
              skipped
                ? {
                    backgroundColor: colors.textMuted,
                    borderColor: colors.textMuted,
                  }
                : { backgroundColor: colors.card, borderColor: colors.border },
            ]}
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
      <Text style={[styles.tagText, { color, fontSize: fontSize.sm }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  timeBox: {
    minWidth: 64,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  time: { fontSize: fontSize.md, fontWeight: '900' },
  info: { flex: 1 },
  med: { fontSize: fontSize.md, fontWeight: '800', color: colors.text },
  sub: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 6 },
  btn: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  tag: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  tagText: { fontSize: fontSize.sm, fontWeight: '800' },
});

