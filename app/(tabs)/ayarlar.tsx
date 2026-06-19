import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useData } from '@/store/DataContext';
import {
  requestNotificationPermission,
  sendTestNotification,
} from '@/utils/notifications';
import { authenticate, canUseAppLock } from '@/utils/auth';
import { colors, fontSize, radius, spacing } from '@/theme';
import { Button, Card, Loading, Section } from '@/components/ui';
import { SwitchField } from '@/components/forms';

const WARN_OPTIONS = [3, 5, 7, 10, 14];
const HOUR_OPTIONS = [8, 9, 10, 12, 18, 20];

export default function SettingsScreen() {
  const { data, loading, updateSettings } = useData();
  const router = useRouter();

  if (loading) return <Loading />;
  const s = data.settings;

  async function onToggleNotifications(v: boolean) {
    if (v) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        // İzin yoksa anahtarı AÇIK bırakmak yanıltıcı olur — kapalı tut.
        Alert.alert(
          'Bildirim izni gerekli',
          'Hatırlatma alabilmek için telefon ayarlarından İlaç Takip uygulamasına bildirim izni verin. İzin verilene kadar hatırlatmalar kapalı kalır.',
        );
        updateSettings({ notificationsEnabled: false });
        return;
      }
    }
    updateSettings({ notificationsEnabled: v });
  }

  async function onToggleAppLock(v: boolean) {
    if (v) {
      const can = await canUseAppLock();
      if (!can) {
        Alert.alert(
          'Kilit kurulamadı',
          'Telefonunuzda biyometri (parmak izi/yüz tanıma) veya ekran kilidi tanımlı değil. Önce telefon ayarlarından bir ekran kilidi kurun.',
        );
        return;
      }
      // Açmadan önce bir kez doğrula (kullanıcı kendini kilitlemesin).
      const ok = await authenticate();
      if (!ok) return;
    }
    updateSettings({ appLockEnabled: v });
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

      <Section title="Güvenlik">
        <Card>
          <SwitchField
            label="Uygulama kilidi"
            description="Açılışta ve uygulamaya her dönüşte biyometri (parmak izi/yüz) veya telefon kilidi sorulur. Hasta verileri telefona erişen başkalarından korunur."
            value={s.appLockEnabled}
            onValueChange={onToggleAppLock}
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

      <Section title="Yedekleme">
        <Card>
          <Text style={styles.help}>
            Veriler yalnızca bu telefonda saklanır. Telefon kaybolursa veriler de
            kaybolur. Düzenli olarak yedek alın.
          </Text>
          <Button
            title="Yedekle / Geri Yükle"
            icon="save-outline"
            variant="secondary"
            onPress={() => router.push('/yedek')}
          />
        </Card>
      </Section>

      <Section title="Test">
        <Button
          title="Test bildirimi gönder"
          icon="notifications-outline"
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
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, { color: active ? colors.white : colors.primaryDark }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  help: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 44,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: fontSize.md, fontWeight: '700' },
  chipActive: { backgroundColor: colors.primary },
  chipInactive: { backgroundColor: colors.primaryLight },
  footer: {
    textAlign: 'center',
    color: colors.textLight,
    fontSize: fontSize.sm,
    marginTop: spacing.xl,
    lineHeight: 20,
  },
});
