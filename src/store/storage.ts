// AsyncStorage üzerinden basit kalıcılık katmanı.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, DEFAULT_SETTINGS } from '../types';

const STORAGE_KEY = 'ilac-takip:data:v1';

export const emptyData: AppData = {
  patients: [],
  medications: [],
  settings: DEFAULT_SETTINGS,
};

export async function loadData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      patients: parsed.patients ?? [],
      medications: parsed.medications ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch (e) {
    console.warn('Veri okunamadı, boş başlanıyor:', e);
    return emptyData;
  }
}

export async function saveData(data: AppData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Veri kaydedilemedi:', e);
  }
}
