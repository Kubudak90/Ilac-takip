import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useData } from '@/store/DataContext';
import { colors, spacing } from '@/theme';
import { Button } from '@/components/ui';
import { NumberField, SwitchField, TextField } from '@/components/forms';

export default function EditPatientScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getPatient, addPatient, updatePatient } = useData();
  const router = useRouter();

  const existing = id ? getPatient(id) : undefined;
  const isEdit = !!existing;

  const [fullName, setFullName] = useState(existing?.fullName ?? '');
  const [birthYear, setBirthYear] = useState<number | undefined>(existing?.birthYear);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [muteNotifications, setMuteNotifications] = useState(
    !!existing?.muteNotifications,
  );

  function onSave() {
    const name = fullName.trim();
    if (!name) {
      Alert.alert('Eksik bilgi', 'Lütfen hasta adını girin.');
      return;
    }
    const currentYear = new Date().getFullYear();
    const validBirthYear =
      birthYear && birthYear > 1900 && birthYear <= currentYear ? birthYear : undefined;

    const payload = {
      fullName: name,
      birthYear: validBirthYear,
      notes: notes.trim(),
      muteNotifications,
    };
    if (isEdit && existing) {
      updatePatient(existing.id, payload);
    } else {
      addPatient(payload);
    }
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: isEdit ? 'Hastayı Düzenle' : 'Yeni Hasta' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <TextField
          label="Ad Soyad *"
          value={fullName}
          onChangeText={setFullName}
          placeholder="örn. Ayşe Yılmaz"
        />
        <NumberField
          label="Doğum Yılı"
          value={birthYear}
          onChangeNumber={(n) => setBirthYear(n || undefined)}
          placeholder="örn. 1948"
        />
        <TextField
          label="Notlar"
          value={notes}
          onChangeText={setNotes}
          placeholder="Tanılar, doktor, hastane vb."
          multiline
        />
        <SwitchField
          label="Bu hasta için bildirimleri sustur"
          description="Açıkken bu hastanın doz/stok/rapor hatırlatmaları planlanmaz. Diğer hastalar etkilenmez."
          value={muteNotifications}
          onValueChange={setMuteNotifications}
        />
        <Button title={isEdit ? 'Kaydet' : 'Hastayı Ekle'} onPress={onSave} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
