// Uygulama genelinde tek veri kaynağı. Yükleme, kaydetme ve
// CRUD işlemlerini sağlar; her değişiklikte bildirimleri yeniden planlar.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppData, Medication, Patient, Settings } from '../types';
import { emptyData, loadData, saveData } from './storage';
import { rescheduleAll } from '../utils/notifications';

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface DataContextValue {
  data: AppData;
  loading: boolean;

  // Hasta
  addPatient: (p: Omit<Patient, 'id' | 'createdAt'>) => string;
  updatePatient: (id: string, patch: Partial<Patient>) => void;
  deletePatient: (id: string) => void;
  getPatient: (id: string) => Patient | undefined;

  // İlaç
  addMedication: (m: Omit<Medication, 'id' | 'createdAt'>) => string;
  updateMedication: (id: string, patch: Partial<Medication>) => void;
  deleteMedication: (id: string) => void;
  getMedication: (id: string) => Medication | undefined;
  medsForPatient: (patientId: string) => Medication[];
  /** Stok güncelle ve stokUpdatedAt'i bugüne çek (ilaç yazdırıldı/alındı). */
  refillMedication: (id: string, newStockUnits: number) => void;

  // Ayarlar
  updateSettings: (patch: Partial<Settings>) => void;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);

  // İlk yükleme
  useEffect(() => {
    let active = true;
    (async () => {
      const loaded = await loadData();
      if (active) {
        setData(loaded);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Her değişiklikte kaydet + bildirimleri yeniden planla (yükleme bitince)
  const isFirst = useRef(true);
  useEffect(() => {
    if (loading) return;
    if (isFirst.current) {
      isFirst.current = false;
    }
    saveData(data);
    rescheduleAll(data.patients, data.medications, data.settings);
  }, [data, loading]);

  // --- Hasta işlemleri ---
  const addPatient = useCallback((p: Omit<Patient, 'id' | 'createdAt'>) => {
    const id = genId();
    const patient: Patient = { ...p, id, createdAt: new Date().toISOString() };
    setData((d) => ({ ...d, patients: [...d.patients, patient] }));
    return id;
  }, []);

  const updatePatient = useCallback((id: string, patch: Partial<Patient>) => {
    setData((d) => ({
      ...d,
      patients: d.patients.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, []);

  const deletePatient = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      patients: d.patients.filter((p) => p.id !== id),
      // Hastanın ilaçlarını da sil
      medications: d.medications.filter((m) => m.patientId !== id),
    }));
  }, []);

  // --- İlaç işlemleri ---
  const addMedication = useCallback(
    (m: Omit<Medication, 'id' | 'createdAt'>) => {
      const id = genId();
      const med: Medication = { ...m, id, createdAt: new Date().toISOString() };
      setData((d) => ({ ...d, medications: [...d.medications, med] }));
      return id;
    },
    [],
  );

  const updateMedication = useCallback(
    (id: string, patch: Partial<Medication>) => {
      setData((d) => ({
        ...d,
        medications: d.medications.map((m) =>
          m.id === id ? { ...m, ...patch } : m,
        ),
      }));
    },
    [],
  );

  const deleteMedication = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      medications: d.medications.filter((m) => m.id !== id),
    }));
  }, []);

  const refillMedication = useCallback((id: string, newStockUnits: number) => {
    setData((d) => ({
      ...d,
      medications: d.medications.map((m) =>
        m.id === id
          ? {
              ...m,
              stockUnits: newStockUnits,
              stockUpdatedAt: new Date().toISOString(),
            }
          : m,
      ),
    }));
  }, []);

  // --- Ayarlar ---
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  // --- Seçiciler (selectors) ---
  const getPatient = useCallback(
    (id: string) => data.patients.find((p) => p.id === id),
    [data.patients],
  );
  const getMedication = useCallback(
    (id: string) => data.medications.find((m) => m.id === id),
    [data.medications],
  );
  const medsForPatient = useCallback(
    (patientId: string) =>
      data.medications.filter((m) => m.patientId === patientId),
    [data.medications],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      data,
      loading,
      addPatient,
      updatePatient,
      deletePatient,
      getPatient,
      addMedication,
      updateMedication,
      deleteMedication,
      getMedication,
      medsForPatient,
      refillMedication,
      updateSettings,
    }),
    [
      data,
      loading,
      addPatient,
      updatePatient,
      deletePatient,
      getPatient,
      addMedication,
      updateMedication,
      deleteMedication,
      getMedication,
      medsForPatient,
      refillMedication,
      updateSettings,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData, DataProvider içinde kullanılmalı');
  return ctx;
}
