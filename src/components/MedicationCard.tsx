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
  isDepleted,
  levelForDays,
  stockCountAgeDays,
  stockRunOutDate,
} from '../utils/status';
import { mealRelationLabel, scheduleSummaryLabel } from '../utils/adherence';
import { daysBetween, formatDose, formatTR, humanDays, parseISO, today } from '../utils/date';

export function MedicationCard({
  med,
  warnDays,
  onPress,
  onRefill,
  onTakePrn,
}: {
  med: Medication;
  warnDays: number;
  onPress?: () => void;
  onRefill?: () => void;
  onTakePrn?: () => void;
}) {
  const stockDays = daysUntilStockOut(med);
  const stockDate = stockRunOutDate(med);
  const depleted = isDepleted(med);
  const stockLevel = depleted ? 'danger' : levelForDays(stockDays, warnDays);
  const countAge = med.trackStock ? stockCountAgeDays(med) : 0;
  const staleCount = med.trackStock && countAge >= 14;
  const isPrn = med.scheduleType === 'prn';
  const mealLabel = mealRelationLabel(med.mealRelation);

  const reportDays = daysUntilReportEnd(med);
  const reportLevel = med.hasReport
    ? levelForDays(reportDays, warnDays)
    : 'ok';

  return (
    <Card onPress={onPress}>
      <View style={styles.header}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: colors.primaryLight,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.sm,
          }}
        >
          <Ionicons
            name={isPrn ? 'medkit' : 'medical'}
            size={19}
            color={colors.primaryDark}
          />
        </View>
        <Text
          style={[styles.name, { color: colors.text, fontSize: fontSize.xl, flex: 1 }]}
          numberOfLines={2}
        >
          {med.name}
        </Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
      </View>

      <View style={styles.metaRow}>
        <Pill
          icon={isPrn ? 'medkit-outline' : 'repeat-outline'}
          text={scheduleSummaryLabel(med)}
        />
        {mealLabel ? (
          <Pill
            icon="restaurant-outline"
            text={mealLabel}
            color={colors.caution}
            bg={colors.cautionBg}
          />
        ) : null}
        {med.trackStock ? (
          <Pill text={`Kalan ~${Math.round(currentRemainingUnits(med))} adet`} />
        ) : (
          <Pill text="Salt hatırlatma" color={colors.textMuted} bg={colors.bg} />
        )}
        {med.doseTimes && med.doseTimes.length > 0 && !isPrn ? (
          <Pill
            icon="time-outline"
            text={med.doseTimes.join(', ')}
            color={colors.primaryDark}
            bg={colors.primaryLight}
          />
        ) : null}
      </View>

      {isPrn ? (
        <Text
          style={[
            styles.noSchedule,
            { color: colors.textMuted, fontSize: fontSize.sm },
          ]}
        >
          İhtiyaç halinde kullanılır — sabit günlük saat takvimi yoktur.
        </Text>
      ) : !med.doseTimes || med.doseTimes.length === 0 ? (
        <Text
          style={[
            styles.noSchedule,
            { color: colors.textLight, fontSize: fontSize.sm },
          ]}
        >
          Doz saati yok — stok elle güncellenir, alım takibi yapılmaz.
        </Text>
      ) : null}

      {staleCount ? (
        <Text
          style={[
            styles.staleCount,
            { color: colors.warning, fontSize: fontSize.sm },
          ]}
        >
          Son sayım {countAge} gün önce — stoğu kontrol edip güncelleyin.
        </Text>
      ) : null}

      {/* Stok durumu */}
      <View style={styles.statusLine}>
        {med.trackStock ? (
          isPrn && !depleted ? (
            <StatusBadge
              level="ok"
              label={`Stok: ${Math.round(currentRemainingUnits(med))} adet (ihtiyaç halinde)`}
            />
          ) : (
            <>
              <StatusBadge
                level={stockLevel}
                label={
                  depleted
                    ? 'İlaç: Stok tükendi'
                    : `İlaç: ${stockDays === null ? '—' : humanDays(stockDays)}`
                }
              />
              {stockDate && !depleted ? (
                <Text
                  style={[
                    styles.dateNote,
                    { color: colors.textMuted, fontSize: fontSize.sm },
                  ]}
                >
                  {formatTR(stockDate)}
                </Text>
              ) : null}
            </>
          )
        ) : (
          <Text
            style={[
              styles.noReport,
              { color: colors.textLight, fontSize: fontSize.sm },
            ]}
          >
            Stok takip edilmiyor (yalnız hatırlatma)
          </Text>
        )}
      </View>

      {/* Rapor durumu */}
      {med.hasReport && med.reportEndDate ? (
        <View style={styles.statusLine}>
          <StatusBadge
            level={reportLevel}
            label={`Rapor: ${reportDays === null ? '—' : humanDays(reportDays)}`}
          />
          <Text
            style={[
              styles.dateNote,
              { color: colors.textMuted, fontSize: fontSize.sm },
            ]}
          >
            {formatTR(parseISO(med.reportEndDate))}
          </Text>
        </View>
      ) : (
        <View style={styles.statusLine}>
          <Text
            style={[
              styles.noReport,
              { color: colors.textLight, fontSize: fontSize.sm },
            ]}
          >
            Raporsuz ilaç
          </Text>
        </View>
      )}

      {med.expiryDate ? <ExpiryLine iso={med.expiryDate} /> : null}

      {med.notes ? (
        <View style={[styles.notesRow, { backgroundColor: colors.bg }]}>
          <Ionicons
            name="create-outline"
            size={14}
            color={colors.textMuted}
            style={{ marginTop: 2 }}
          />
          <Text
            style={[
              styles.notes,
              { color: colors.textMuted, fontSize: fontSize.sm },
            ]}
          >
            {med.notes}
          </Text>
        </View>
      ) : null}

      {isPrn && onTakePrn && (!med.trackStock || currentRemainingUnits(med) > 0) ? (
        <Pressable
          onPress={onTakePrn}
          style={[styles.prnBtn, { backgroundColor: colors.primaryLight }]}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color={colors.primaryDark}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.prnText,
              { color: colors.primaryDark, fontSize: fontSize.md },
            ]}
          >
            İhtiyaç dozu aldım ({formatDose(med.dailyDose)} adet düş)
          </Text>
        </Pressable>
      ) : null}

      {onRefill ? (
        <Pressable
          onPress={onRefill}
          style={[styles.refillBtn, { backgroundColor: colors.okBg }]}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={colors.ok}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.refillText,
              { color: colors.ok, fontSize: fontSize.md },
            ]}
          >
            İlaç yazdırdım / stok ekle
          </Text>
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
      <Text style={[styles.expiry, { color, fontSize: fontSize.sm }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
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
  staleCount: {
    fontSize: fontSize.sm,
    color: colors.warning,
    fontWeight: '700',
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
  prnBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prnText: { fontWeight: '800' },
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

