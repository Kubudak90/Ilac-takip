// Bir ilacın stok ve rapor durumunu özetleyen kart.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Medication } from '../types';
import { colors, fontSize, spacing } from '../theme';
import { Card, Pill, StatusBadge } from './ui';
import {
  daysUntilReportEnd,
  daysUntilStockOut,
  levelForDays,
  stockRunOutDate,
} from '../utils/status';
import { daysBetween, formatTR, humanDays, parseISO, today } from '../utils/date';

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
        <Pill text={`Günde ${med.dailyDose} adet`} />
        <Pill text={`Stok: ${med.stockUnits} adet`} />
        {med.doseTimes && med.doseTimes.length > 0 ? (
          <Pill
            text={`⏰ ${med.doseTimes.join(', ')}`}
            color={colors.primaryDark}
            bg={colors.primaryLight}
          />
        ) : null}
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

      {med.expiryDate ? <ExpiryLine iso={med.expiryDate} /> : null}

      {med.notes ? <Text style={styles.notes}>📝 {med.notes}</Text> : null}

      {onRefill ? (
        <Pressable onPress={onRefill} style={styles.refillBtn}>
          <Text style={styles.refillText}>✓ İlaç yazdırdım / stok ekle</Text>
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
    ? `⚠️ Son kullanma geçti (${formatTR(d)})`
    : `Son kullanma: ${formatTR(d)}`;
  return <Text style={[styles.expiry, { color }]}>{label}</Text>;
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
  expiry: { marginTop: spacing.sm, fontSize: fontSize.sm, fontWeight: '600' },
  refillBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.okBg,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  refillText: { color: colors.ok, fontWeight: '800', fontSize: fontSize.md },
});
