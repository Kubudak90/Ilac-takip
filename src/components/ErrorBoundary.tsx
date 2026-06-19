// Render hatası yakalayıcı: bir ekran çökerse beyaz ekran yerine kurtarma UI
// gösterir. Veriler diskte güvende kalır (bu yalnızca arayüz hatasını yakalar).

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, radius, spacing } from '../theme';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Beklenmeyen arayüz hatası:', error);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.danger} />
        <Text style={styles.title}>Bir sorun oluştu</Text>
        <Text style={styles.sub}>
          Verileriniz telefonda güvende. Lütfen tekrar deneyin; sorun sürerse
          uygulamayı kapatıp yeniden açın.
        </Text>
        <Pressable
          style={styles.btn}
          onPress={this.reset}
          accessibilityRole="button"
          accessibilityLabel="Yeniden dene"
        >
          <Ionicons name="refresh" size={22} color={colors.white} style={{ marginRight: 8 }} />
          <Text style={styles.btnText}>Yeniden Dene</Text>
        </Pressable>
      </View>
    );
  }
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
  sub: { fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center' },
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
