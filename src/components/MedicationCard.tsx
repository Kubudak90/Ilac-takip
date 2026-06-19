// Bir ilacın stok ve rapor durumunu özetleyen kart.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Medication } from '../types';
import { colors, fontSize, spacing } from '../theme';
import { Card, Pill, StatusBadge } from './ui';
import {
  currentRemainingUnits,
  daysUntilReportEnd,
  daysUntilStockOut,
  levelForDays,
  stockRunOutDate,
} from '../utils/status';
import { daysBetween, formatDose, formatTR, humanDays, parseISO, today } from '../utils/date';

export function MedicationCard({
  med,
  warnDays,
  onPress,
  onRefill,
}: {
  med: Medication;
  warnDays: number;
  onPress?: () => void;
  onRefill?: () => void;
}) {
  const stockDays = daysUntilStockOut(med);
  const stockDate = stockRunOutDate(med);
  const stockLevel = levelForDays(stockDays, warnDays);

  const reportDays = daysUntilReportEnd(med);
  const reportLevel = med.hasReport
    ? levelForDays(reportDays, warnDays)
    : 'ok';

  return (
    <Card onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={2}>
          {med.name}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Pill text={`Günde ${formatDose(med.dailyDose)} adet`} />
        <Pill text={`Kalan ~${Math.round(currentRemainingUnits(med))} adet`} />
        {med.doseTimes && med.doseTimes.length > 0 ? (
          <Pill
            icon="time-outline"
            text={med.doseTimes.join(', ')}
            color={colors.primaryDark}
            bg={colors.primaryLight}
          />
        ) : null}
      </View>

      {!med.doseTimes || med.doseTimes.length === 0 ? (
        <Text style={styles.noSchedule}>
          Doz saati yok — stok elle güncellenir, alım takibi yapılmaz.
        </Text>
      ) : null}

      {/* Stok durumu */}
      <View style={styles.statusLine}>
        <StatusBadge
          level={stockLevel}
          label={`İlaç: ${stockDays === null ? '—' : humanDays(stockDays)}`}
        />
        {stockDate ? (
          <Text style={styles.dateNote}>{formatTR(stockDate)}</Text>
        ) : null}
      </View>

      {/* Rapor durumu */}
      {med.hasReport && med.reportEndDate ? (
        <View style={styles.statusLine}>
          <StatusBadge
            level={reportLevel}
            label={`Rapor: ${reportDays === null ? '—' : humanDays(reportDays)}`}
          />
          <Text style={styles.dateNote}>
            {formatTR(parseISO(med.reportEndDate))}
          </Text>
        </View>
      ) : (
        <View style={styles.statusLine}>
          <Text style={styles.noReport}>Raporsuz ilaç</Text>
        </View>
      )}

      {med.expiryDate ? <ExpiryLine iso={med.expiryDate} /> : null}

      {med.notes ? (
        <View style={styles.notesRow}>
          <Ionicons name="create-outline" size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
          <Text style={styles.notes}>{med.notes}</Text>
        </View>
      ) : null}

      {onRefill ? (
        <Pressable onPress={onRefill} style={styles.refillBtn}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.ok} style={{ marginRight: 6 }} />
          <Text style={styles.refillText}>İlaç yazdırdım / stok ekle</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function ExpiryLine({ iso }: { iso: string }) {
  const d = parseISO(iso);
  const days = daysBetween(today(), d);
  const expired = days < 0;
  const near = days >= 0 && days <= 30;
  const color = expired ? colors.danger : near ? colors.warning : colors.textMuted;
  const label = expired
    ? `Son kullanma geçti (${formatTR(d)})`
    : `Son kullanma: ${formatTR(d)}`;
  return (
    <View style={styles.expiryRow}>
      {expired ? (
        <Ionicons name="warning-outline" size={14} color={color} style={{ marginRight: 4 }} />
      ) : null}
      <Text style={[styles.expiry, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm },
  name: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  dateNote: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600' },
  noSchedule: {
    fontSize: fontSize.sm,
    color: colors.textLight,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  noReport: { fontSize: fontSize.sm, color: colors.textLight, fontStyle: 'italic' },
  notesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.md,
    backgroundColor: colors.bg,
    padding: spacing.sm,
    borderRadius: 8,
  },
  notes: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  expiryRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  expiry: { fontSize: fontSize.sm, fontWeight: '600' },
  refillBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.okBg,
    paddingVertical: spacing.md,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refillText: { color: colors.ok, fontWeight: '800', fontSize: fontSize.md },
});
