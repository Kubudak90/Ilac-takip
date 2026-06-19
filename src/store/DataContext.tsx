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
import { AppState } from 'react-native';
import { AppData, DoseEvent, Medication, Patient, Settings } from '../types';
import { emptyData, loadData, saveData } from './storage';
import {
  getNotificationPermissionGranted,
  onAppForeground,
  rescheduleAll,
} from '../utils/notifications';
import { createdDayKey, doseKey, doseSizeFor } from '../utils/adherence';
import { roundUnits } from '../utils/date';

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface DataContextValue {
  data: AppData;
  loading: boolean;
  /** Depo okunamadı/bozuktu — kurtarılabilir veriyi ezmemek için kayıt durduruldu. */
  loadFailed: boolean;
  /** Sistem bildirim izni verilmiş mi (ayar açık olsa bile false olabilir). */
  notificationsGranted: boolean;

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

  // Doz / uyum
  /**
   * Bir dozu işaretle/geri al. status="taken" stoktan düşer (geri alınabilir),
   * "skipped" sadece kaydeder. Aynı durum tekrar verilirse işaret kaldırılır.
   */
  setDoseStatus: (
    medId: string,
    dayKey: string,
    time: string,
    status: 'taken' | 'skipped',
  ) => void;

  // Ayarlar
  updateSettings: (patch: Partial<Settings>) => void;

  /** Yedekten geri yükle: tüm veriyi içe aktarılan veriyle değiştirir. */
  restoreData: (incoming: AppData) => void;

  // Barkod defteri
  /** Okutulan GTIN için kayıtlı ilaç adı (varsa). */
  lookupBarcode: (gtin: string) => string | undefined;
  /** Bir GTIN -> ilaç adı eşleşmesini kaydeder (uygulama öğrenir). */
  saveBarcodeName: (gtin: string, name: string) => void;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(true);

  // İlk yüklenen veri referansı: kaydetme efekti "veri gerçekten değişti mi?"
  // kararını bu referansla verir (bkz. aşağıdaki efekt).
  const loadedRef = useRef<AppData | null>(null);

  // Depo okuması başarısızsa (ok=false) kaydetmeyi TAMAMEN engelleriz; aksi
  // halde ilk düzenleme, geçici okunamamış/bozuk ama kurtarılabilir veriyi boş
  // veriyle kalıcı olarak ezer (bkz. storage.ts LoadResult.ok sözleşmesi).
  const loadOkRef = useRef(true);

  // İlk yükleme
  useEffect(() => {
    let active = true;
    (async () => {
      const loaded = await loadData();
      if (active) {
        loadedRef.current = loaded.data;
        loadOkRef.current = loaded.ok;
        setData(loaded.data);
        setLoadFailed(!loaded.ok);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // En güncel veriye, render dışı geri çağrılardan (uygulama öne gelince)
  // erişmek için ref.
  const dataRef = useRef(data);
  dataRef.current = data;

  // Veri değişince kaydet + bildirimleri yeniden planla (yükleme bitince).
  //
  // KAYIT yalnızca veri GERÇEKTEN değiştiğinde yapılır (referans karşılaştırma):
  // tüm güncelleyiciler yeni nesne üretir, ilk yüklenen veri ise loadedRef'tedir.
  // Böylece (a) okuma hatasında bellekteki boş veri depodaki kurtarılabilir
  // veriyi ezmez, (b) React Strict Mode'da efektin yeniden bağlanması yanlışlıkla
  // kayıt tetiklemez. Bildirimler her durumda (açılışta da) güncel tarihe göre
  // kurulur. Yazma/planlama, hızlı düzenlemelerde gereksiz tekrarı önlemek için
  // kısa süre geciktirilir (debounce).
  useEffect(() => {
    if (loading) return;
    // Depo okunamadı/bozuktu: kurtarılabilir veriyi ezmemek için ASLA yazma.
    // Bildirimleri yine de bellekteki güncel veriye göre kur.
    if (!loadOkRef.current) {
      rescheduleAll(data.patients, data.medications, data.settings);
      return;
    }
    const changed = data !== loadedRef.current;
    if (!changed) {
      rescheduleAll(data.patients, data.medications, data.settings);
      return;
    }
    const t = setTimeout(() => {
      saveData(data);
      rescheduleAll(data.patients, data.medications, data.settings);
    }, 400);
    return () => clearTimeout(t);
  }, [data, loading]);

  // Uygulama öne geldiğinde (ör. ertesi gün) bildirimleri güncel tarihe göre
  // yeniden kur — böylece "X gün kala" tetikleyicileri kaymaz, geçen güne ait
  // uyarılar atlanmaz, tükenen ilaçların hatırlatması durur.
  useEffect(() => {
    if (loading) return;
    let active = true;
    // Gerçek bildirim izni durumunu açılışta ve her öne gelişte tazele; ayar
    // "açık" ama izin yoksa UI kullanıcıyı uyarabilsin (sessiz arıza önleme).
    const refreshPermission = () => {
      getNotificationPermissionGranted().then((g) => {
        if (active) setNotificationsGranted(g);
      });
    };
    refreshPermission();
    const unsub = onAppForeground(() => {
      const d = dataRef.current;
      rescheduleAll(d.patients, d.medications, d.settings);
      refreshPermission();
    });
    return () => {
      active = false;
      unsub();
    };
  }, [loading]);

  // Uygulama arka plana alınınca/kapanırken bekleyen değişikliği HEMEN yaz:
  // 400ms debounce dolmadan kapatılırsa son doz işareti kaybolmasın.
  useEffect(() => {
    if (loading) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (
        (state === 'background' || state === 'inactive') &&
        loadOkRef.current
      ) {
        saveData(dataRef.current);
      }
    });
    return () => sub.remove();
  }, [loading]);

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
      // Hastanın ilaçlarını ve doz kayıtlarını da sil
      medications: d.medications.filter((m) => m.patientId !== id),
      doseLog: d.doseLog.filter((e) => e.patientId !== id),
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
      doseLog: d.doseLog.filter((e) => e.medId !== id),
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
              // Yenileme = stok takibi yapılıyor demektir.
              trackStock: true,
            }
          : m,
      ),
    }));
  }, []);

  // --- Doz / uyum ---
  const setDoseStatus = useCallback(
    (
      medId: string,
      dayKey: string,
      time: string,
      status: 'taken' | 'skipped',
    ) => {
      setData((d) => {
        const med = d.medications.find((m) => m.id === medId);
        if (!med) return d;
        // İlaç oluşturulmadan önceki bir güne yazma: sahte geriye-dönük kayıt
        // ve gerçek stok düşümünü engelle (UI bunu üretmez ama savunma katmanı).
        if (dayKey < createdDayKey(med)) return d;
        const key = doseKey(medId, dayKey, time);
        const existing = d.doseLog.find((e) => e.id === key);

        // Aynı durum tekrar işaretlendi -> geri al: kaydı sil, stoğu iade et.
        if (existing && existing.status === status) {
          const stock = roundUnits(med.stockUnits + existing.appliedUnits);
          return {
            ...d,
            medications: d.medications.map((m) =>
              m.id === medId ? { ...m, stockUnits: stock } : m,
            ),
            doseLog: d.doseLog.filter((e) => e.id !== key),
          };
        }

        // Önceki "taken" tüketimini geri ver, sonra yeni durumu uygula.
        const oldApplied =
          existing && existing.status === 'taken' ? existing.appliedUnits : 0;
        let stock = med.stockUnits + oldApplied;
        let applied = 0;
        if (status === 'taken') {
          // Stok 0'ın altına inemez; gerçekten düşülen miktarı kaydet (geri-alma
          // için), böylece iade tam olur.
          applied = Math.min(doseSizeFor(med), Math.max(0, stock));
          stock = stock - applied;
        }
        stock = roundUnits(Math.max(0, stock));

        const event: DoseEvent = {
          id: key,
          medId,
          patientId: med.patientId,
          dayKey,
          time,
          status,
          appliedUnits: roundUnits(applied),
          loggedAt: new Date().toISOString(),
        };
        const doseLog = existing
          ? d.doseLog.map((e) => (e.id === key ? event : e))
          : [...d.doseLog, event];
        return {
          ...d,
          medications: d.medications.map((m) =>
            m.id === medId ? { ...m, stockUnits: stock } : m,
          ),
          doseLog,
        };
      });
    },
    [],
  );

  // --- Ayarlar ---
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  // --- Geri yükleme ---
  const restoreData = useCallback((incoming: AppData) => {
    // Kullanıcı bilinçli olarak üzerine yazıyor: kayıt kilidini aç, uyarıyı kaldır.
    loadOkRef.current = true;
    setLoadFailed(false);
    setData(() => ({
      patients: incoming.patients ?? [],
      medications: incoming.medications ?? [],
      doseLog: incoming.doseLog ?? [],
      settings: { ...emptyData.settings, ...(incoming.settings ?? {}) },
      barcodeBook: incoming.barcodeBook ?? {},
    }));
  }, []);

  // --- Barkod defteri ---
  const lookupBarcode = useCallback(
    (gtin: string) => data.barcodeBook[gtin],
    [data.barcodeBook],
  );
  const saveBarcodeName = useCallback((gtin: string, name: string) => {
    if (!gtin || !name.trim()) return;
    setData((d) => ({
      ...d,
      barcodeBook: { ...d.barcodeBook, [gtin]: name.trim() },
    }));
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
      loadFailed,
      notificationsGranted,
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
      setDoseStatus,
      updateSettings,
      restoreData,
      lookupBarcode,
      saveBarcodeName,
    }),
    [
      data,
      loading,
      loadFailed,
      notificationsGranted,
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
      setDoseStatus,
      updateSettings,
      restoreData,
      lookupBarcode,
      saveBarcodeName,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData, DataProvider içinde kullanılmalı');
  return ctx;
}
