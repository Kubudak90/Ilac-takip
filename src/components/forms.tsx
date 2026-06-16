// Form girdileri: metin, sayı, tarih seçici, anahtar (switch).

import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, fontSize, radius, spacing } from '../theme';
import { formatTR } from '../utils/date';
import { Label } from './ui';

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

export function NumberField({
  label,
  value,
  onChangeNumber,
  placeholder,
  suffix,
}: {
  label: string;
  value: number | undefined;
  onChangeNumber: (n: number) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={value === undefined || Number.isNaN(value) ? '' : String(value)}
          onChangeText={(t) => {
            const cleaned = t.replace(/[^0-9]/g, '');
            onChangeNumber(cleaned === '' ? 0 : parseInt(cleaned, 10));
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          keyboardType="numeric"
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  minimumDate?: Date;
}) {
  const [show, setShow] = useState(false);

  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <Pressable
        style={styles.input}
        onPress={() => setShow((s) => !s)}
      >
        <Text style={styles.dateText}>{formatTR(value)}</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          onChange={(event, selected) => {
            if (Platform.OS !== 'ios') setShow(false);
            if (event.type === 'set' && selected) onChange(selected);
          }}
        />
      )}
    </View>
  );
}

/** "HH:MM" biçiminde saat listesi düzenleyici (ilaç saatleri). */
export function TimeListField({
  label,
  times,
  onChange,
}: {
  label: string;
  times: string[];
  onChange: (t: string[]) => void;
}) {
  const [show, setShow] = useState(false);

  function addTime(d: Date) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const t = `${hh}:${mm}`;
    if (times.includes(t)) return;
    onChange([...times, t].sort());
  }

  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <View style={styles.timeRow}>
        {times.map((t) => (
          <Pressable
            key={t}
            onPress={() => onChange(times.filter((x) => x !== t))}
            style={styles.timeChip}
          >
            <Text style={styles.timeChipText}>{t}  ✕</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setShow(true)} style={styles.timeAdd}>
          <Text style={styles.timeAddText}>+ saat</Text>
        </Pressable>
      </View>
      {times.length === 0 ? (
        <Text style={styles.timeHint}>Saat eklemezseniz günlük hatırlatma kurulmaz.</Text>
      ) : null}
      {show && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selected) => {
            if (Platform.OS !== 'ios') setShow(false);
            if (event.type === 'set' && selected) addTime(selected);
          }}
        />
      )}
    </View>
  );
}

export function SwitchField({
  label,
  value,
  onValueChange,
  description,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <View style={[styles.field, styles.switchRow]}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Label style={{ marginBottom: description ? 4 : 0 }}>{label}</Label>
        {description ? (
          <Text style={styles.switchDesc}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
    fontSize: fontSize.lg,
    color: colors.text,
    justifyContent: 'center',
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: spacing.md },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  suffix: { fontSize: fontSize.md, color: colors.textMuted, fontWeight: '600' },
  dateText: { fontSize: fontSize.lg, color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switchDesc: { fontSize: fontSize.sm, color: colors.textMuted },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  timeChip: {
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  timeChipText: { color: colors.primaryDark, fontWeight: '700', fontSize: fontSize.md },
  timeAdd: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  timeAddText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.md },
  timeHint: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm },
});
