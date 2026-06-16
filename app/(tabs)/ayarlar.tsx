import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useData } from '@/store/DataContext';
import {
  requestNotificationPermission,
  sendTestNotification,
} from '@/utils/notifications';
import { colors, fontSize, radius, spacing } from '@/theme';
import { Button, Card, Loading, Section } from '@/components/ui';
import { SwitchField } from '@/components/forms';

const WARN_OPTIONS = [3, 5, 7, 10, 14];
const HOUR_OPTIONS = [8, 9, 10, 12, 18, 20];

export default function SettingsScreen() {
  const { data, loading, updateSettings } = useData();

  if (loading) return <Loading />;
  const s = data.settings;

  async function onToggleNotifications(v: boolean) {
    if (v) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Bildirim izni gerekli',
          'Hatırlatma alabilmek için telefon ayarlarından İlaç Takip uygulamasına bildirim izni verin.',
        );
      }
    }
    updateSettings({ notificationsEnabled: v });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Section title="Bildirimler">
        <Card>
          <SwitchField
            label="Hatırlatmalar açık"
            description="İlaç veya rapor bitmeden önce telefonunuza bildirim gelsin."
            value={s.notificationsEnabled}
            onValueChange={onToggleNotifications}
          />
        </Card>
      </Section>

      <Section title="Kaç gün önceden uyarılsın?">
        <Card>
          <Text style={styles.help}>
            Bitişe bu kadar gün kala “yakında” uyarısı ve bildirim alırsınız.
          </Text>
          <View style={styles.chips}>
            {WARN_OPTIONS.map((d) => (
              <Chip
                key={d}
                label={`${d} gün`}
                active={s.warnDaysBefore === d}
                onPress={() => updateSettings({ warnDaysBefore: d })}
              />
            ))}
          </View>
        </Card>
      </Section>

      <Section title="Günlük hatırlatma saati">
        <Card>
          <Text style={styles.help}>Bildirimler bu saatte gönderilir.</Text>
          <View style={styles.chips}>
            {HOUR_OPTIONS.map((h) => (
              <Chip
                key={h}
                label={`${String(h).padStart(2, '0')}:00`}
                active={s.reminderHour === h}
                onPress={() => updateSettings({ reminderHour: h })}
              />
            ))}
          </View>
        </Card>
      </Section>

      <Section title="Test">
        <Button
          title="🔔 Test bildirimi gönder"
          variant="secondary"
          onPress={async () => {
            const granted = await requestNotificationPermission();
            if (!granted) {
              Alert.alert('İzin yok', 'Önce bildirim iznini verin.');
              return;
            }
            await sendTestNotification();
            Alert.alert('Gönderildi', '3 saniye içinde örnek bildirim gelecek.');
          }}
        />
      </Section>

      <Text style={styles.footer}>
        İlaç Takip · v1.0{'\n'}
        Veriler yalnızca bu telefonda saklanır.
      </Text>
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Text
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  help: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    fontSize: fontSize.md,
    fontWeight: '700',
    overflow: 'hidden',
  },
  chipActive: { backgroundColor: colors.primary, color: colors.white },
  chipInactive: { backgroundColor: colors.primaryLight, color: colors.primaryDark },
  footer: {
    textAlign: 'center',
    color: colors.textLight,
    fontSize: fontSize.sm,
    marginTop: spacing.xl,
    lineHeight: 20,
  },
});
