import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useData } from '@/store/DataContext';
import { colors, spacing } from '@/theme';
import { Button } from '@/components/ui';
import { NumberField, TextField } from '@/components/forms';

export default function EditPatientScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getPatient, addPatient, updatePatient } = useData();
  const router = useRouter();

  const existing = id ? getPatient(id) : undefined;
  const isEdit = !!existing;

  const [fullName, setFullName] = useState(existing?.fullName ?? '');
  const [birthYear, setBirthYear] = useState<number | undefined>(existing?.birthYear);
  const [notes, setNotes] = useState(existing?.notes ?? '');

  function onSave() {
    const name = fullName.trim();
    if (!name) {
      Alert.alert('Eksik bilgi', 'Lütfen hasta adını girin.');
      return;
    }
    const currentYear = new Date().getFullYear();
    const validBirthYear =
      birthYear && birthYear > 1900 && birthYear <= currentYear ? birthYear : undefined;

    if (isEdit && existing) {
      updatePatient(existing.id, { fullName: name, birthYear: validBirthYear, notes: notes.trim() });
    } else {
      addPatient({ fullName: name, birthYear: validBirthYear, notes: notes.trim() });
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
        <Button title={isEdit ? 'Kaydet' : 'Hastayı Ekle'} onPress={onSave} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
