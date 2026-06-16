// Bir ilacın stok ve rapor durumunu özetleyen kart.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Medication } from '../types';
import { colors, fontSize, spacing } from '../theme';
import { Card, Pill, StatusBadge } from './ui';
import {
  daysUntilReportEnd,
  daysUntilStockOut,
  levelForDays,
  stockRunOutDate,
} from '../utils/status';
import { formatTR, humanDays, parseISO } from '../utils/date';

export function MedicationCard({
  med,
  warnDays,
  onPress,
}: {
  med: Medication;
  warnDays: number;
  onPress?: () => void;
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
        <Pill text={`Günde ${med.dailyDose} adet`} />
        <Pill text={`Stok: ${med.stockUnits} adet`} />
      </View>

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

      {med.notes ? <Text style={styles.notes}>📝 {med.notes}</Text> : null}
    </Card>
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
  noReport: { fontSize: fontSize.sm, color: colors.textLight, fontStyle: 'italic' },
  notes: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    backgroundColor: colors.bg,
    padding: spacing.sm,
    borderRadius: 8,
  },
});
