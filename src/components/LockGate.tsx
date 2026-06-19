// Uygulama kilidi kapısı: appLockEnabled açıkken, içerik gösterilmeden önce
// biyometri/cihaz kilidi ile doğrulama ister; uygulama arka plana alınınca
// yeniden kilitlenir. Kilit kapalıysa hiçbir engel yok.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useData } from '../store/DataContext';
import { authenticate } from '../utils/auth';
import { colors, fontSize, radius, spacing } from '../theme';

export function LockGate({ children }: { children: React.ReactNode }) {
  const { data, loading } = useData();
  const enabled = data.settings.appLockEnabled;
  const [unlocked, setUnlocked] = useState(false);
  const authingRef = useRef(false);

  const tryUnlock = useCallback(async () => {
    if (authingRef.current) return;
    authingRef.current = true;
    const ok = await authenticate();
    authingRef.current = false;
    if (ok) setUnlocked(true);
  }, []);

  // Veri yüklenmeden karar verme (settings.appLockEnabled bilinmiyor); yüklenince
  // kilit kapalıysa aç, açıksa ve kilitliyse doğrulama iste.
  useEffect(() => {
    if (loading) return;
    if (!enabled) {
      setUnlocked(true);
      return;
    }
    if (!unlocked) tryUnlock();
  }, [loading, enabled, unlocked, tryUnlock]);

  // Arka plana alınınca yeniden kilitle.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') setUnlocked(false);
    });
    return () => sub.remove();
  }, [enabled]);

  // Yükleme sırasında nötr ekran: içerik kilit kararından önce SIZMAZ.
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (enabled && !unlocked) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={64} color={colors.primary} />
        <Text style={styles.title}>İlaç Takip kilitli</Text>
        <Text style={styles.sub}>Devam etmek için kimliğinizi doğrulayın.</Text>
        <Pressable
          style={styles.btn}
          onPress={tryUnlock}
          accessibilityRole="button"
          accessibilityLabel="Kilidi aç"
        >
          <Ionicons
            name="finger-print"
            size={22}
            color={colors.white}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.btnText}>Kilidi Aç</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  sub: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 54,
    marginTop: spacing.md,
  },
  btnText: { color: colors.white, fontSize: fontSize.lg, fontWeight: '800' },
});
