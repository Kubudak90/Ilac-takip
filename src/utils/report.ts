// Doktor ve eczane ziyaretleri için paylaşılabilir/yazdırılabilir özet metin üreticileri.

import { DoseEvent, Medication, Patient } from '../types';
import {
  adherenceSummary,
  indexLog,
  lastNDayKeys,
  mealRelationLabel,
  scheduleSummaryLabel,
} from './adherence';
import {
  buildUrgencyList,
  currentRemainingUnits,
  daysUntilExpiry,
  daysUntilReportEnd,
  daysUntilStockOut,
  isDepleted,
  isExpired,
  levelForDays,
  stockRunOutDate,
} from './status';
import { formatTR, formatTRFromISO, humanDays, today, todayKey } from './date';

/**
 * Tek bir hasta için kapsamlı Doktor / Eczane Ziyaret Özeti üretir.
 * İçerik: hasta bilgisi, tanı/notlar, son 30 günlük doz uyum özeti,
 * acil yenilenmesi gereken ilaç/raporlar ve tüm ilaçların detaylı listesi.
 */
export function buildPatientReport(
  patient: Patient,
  meds: Medication[],
  warnDays: number,
  doseLog: DoseEvent[] = [],
): string {
  const age = patient.birthYear
    ? `${new Date().getFullYear() - patient.birthYear} yaşında`
    : '';
  const header = `${patient.fullName}${age ? ` (${age})` : ''} — Doktor / Eczane İlaç Özeti`;
  const lines: string[] = [
    header,
    `Tarih: ${formatTR(today())}`,
  ];

  if (patient.notes && patient.notes.trim()) {
    lines.push(`Hasta Notu / Tanılar: ${patient.notes.trim()}`);
  }

  // Son 30 gün uyum özeti
  const hasScheduled = meds.some(
    (m) => (m.scheduleType ?? 'daily') !== 'prn' && m.doseTimes && m.doseTimes.length > 0,
  );
  if (hasScheduled && doseLog.length > 0) {
    const logByKey = indexLog(doseLog);
    const sum30 = adherenceSummary(meds, logByKey, lastNDayKeys(30), todayKey());
    if (sum30.total > 0) {
      lines.push(
        `Son 30 Gün İlaç Uyumu: %${Math.round(sum30.rate * 100)} (${sum30.taken} alındı, ${sum30.skipped} atlandı, ${sum30.missed} kaçırıldı)`,
      );
    }
  }

  lines.push('');

  if (meds.length === 0) {
    lines.push('Kayıtlı ilaç yok.');
    lines.push('');
    lines.push('— İlaç Takip uygulamasından paylaşıldı');
    return lines.join('\n');
  }

  // Acil / Yenilenmesi gerekenler özeti
  const urgentLines: string[] = [];
  for (const m of meds) {
    if (isDepleted(m)) {
      urgentLines.push(`• [TÜKENDİ] ${m.name} — Stok bitti, yenilenmeli${m.barcode ? ` (Barkod: ${m.barcode})` : ''}`);
    } else {
      const stockDays = daysUntilStockOut(m);
      if (stockDays !== null && levelForDays(stockDays, warnDays) !== 'ok') {
        urgentLines.push(
          `• [STOK AZALDI] ${m.name} — ${humanDays(stockDays)} (Kalan: ~${Math.round(currentRemainingUnits(m))} adet)`,
        );
      }
    }
    const repDays = daysUntilReportEnd(m);
    if (m.hasReport && m.reportEndDate && repDays !== null && levelForDays(repDays, warnDays) !== 'ok') {
      urgentLines.push(
        `• [RAPOR] ${m.name} — Rapor: ${humanDays(repDays)} (${formatTRFromISO(m.reportEndDate)})`,
      );
    }
    const expDays = daysUntilExpiry(m);
    if (m.expiryDate && expDays !== null && expDays <= 30) {
      urgentLines.push(
        `• [SON KULLANMA] ${m.name} — ${expDays < 0 ? 'Son kullanma geçti!' : `SKT: ${humanDays(expDays)}`} (${formatTRFromISO(m.expiryDate)})`,
      );
    }
  }

  if (urgentLines.length > 0) {
    lines.push('⚠️ DİKKAT / YENİLENMESİ GEREKENLER:');
    lines.push(...urgentLines);
    lines.push('');
  }

  lines.push(`TÜM İLAÇLAR (${meds.length}):`);
  meds.forEach((m, i) => {
    const meal = mealRelationLabel(m.mealRelation);
    const schedule = scheduleSummaryLabel(m);
    lines.push(`${i + 1}. ${m.name}`);
    lines.push(`   Kullanım: ${schedule}${meal ? ` · ${meal}` : ''}`);
    if (m.doseTimes && m.doseTimes.length > 0) {
      lines.push(`   Saatler: ${m.doseTimes.join(', ')}`);
    }
    if (m.trackStock) {
      const rem = Math.round(currentRemainingUnits(m));
      const runOut = stockRunOutDate(m);
      if (isDepleted(m)) {
        lines.push('   Stok: TÜKENDİ (0 adet)');
      } else if (runOut) {
        lines.push(`   Stok: ~${rem} adet · Tahmini bitiş: ${formatTR(runOut)}`);
      } else {
        lines.push(`   Stok: ~${rem} adet`);
      }
    } else {
      lines.push('   Stok: Takip edilmiyor (yalnız hatırlatma)');
    }
    if (m.hasReport && m.reportEndDate) {
      lines.push(`   Rapor bitiş: ${formatTRFromISO(m.reportEndDate)}`);
    }
    if (m.expiryDate) {
      lines.push(`   Son kullanma: ${formatTRFromISO(m.expiryDate)}`);
    }
    if (m.barcode) {
      lines.push(`   Barkod (GTIN): ${m.barcode}`);
    }
    if (m.notes) {
      lines.push(`   Not: ${m.notes}`);
    }
    lines.push('');
  });

  lines.push('— İlaç Takip uygulamasından paylaşıldı');
  return lines.join('\n');
}

/**
 * Bir veya birden çok hasta için yalnızca YAZDIRILMASI / YENİLENMESİ gereken
 * ilaç ve raporları içeren "Reçete & Eczane Yenileme Listesi" üretir.
 */
export function buildPharmacyRenewalList(
  patients: Patient[],
  medications: Medication[],
  warnDays: number,
): string {
  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const depleted = medications.filter((m) => isDepleted(m));
  const expired = medications.filter((m) => isExpired(m));
  const urgency = buildUrgencyList(medications, warnDays).filter(
    (it) => it.level !== 'ok',
  );

  // Hasta bazında grupla
  const byPatient = new Map<string, string[]>();
  const addLine = (patientId: string, line: string) => {
    const arr = byPatient.get(patientId) ?? [];
    if (!arr.includes(line)) arr.push(line);
    byPatient.set(patientId, arr);
  };

  for (const m of depleted) {
    const meal = mealRelationLabel(m.mealRelation);
    const extra = [
      scheduleSummaryLabel(m),
      meal,
      m.barcode ? `Barkod: ${m.barcode}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    addLine(m.patientId, `• ${m.name} — STOK BİTTİ (${extra})`);
  }

  for (const m of expired) {
    addLine(
      m.patientId,
      `• ${m.name} — SON KULLANMA GEÇTİ (${formatTRFromISO(m.expiryDate!)})`,
    );
  }

  for (const it of urgency) {
    const m = it.medication;
    if (it.kind === 'stock') {
      const rem = Math.round(currentRemainingUnits(m));
      const bc = m.barcode ? ` · Barkod: ${m.barcode}` : '';
      addLine(
        m.patientId,
        `• ${m.name} — İlaç bitiyor: ${humanDays(it.daysLeft)} (Kalan ~${rem} adet, ${formatTR(it.date)})${bc}`,
      );
    } else if (it.kind === 'report') {
      addLine(
        m.patientId,
        `• ${m.name} — Rapor yenilenecek: ${humanDays(it.daysLeft)} (${formatTR(it.date)})`,
      );
    } else if (it.kind === 'expiry' && it.daysLeft >= 0) {
      addLine(
        m.patientId,
        `• ${m.name} — Son kullanma yaklaşıyor: ${humanDays(it.daysLeft)} (${formatTR(it.date)})`,
      );
    }
  }

  const lines: string[] = [
    'Reçete / Eczane Yenileme Listesi',
    `Tarih: ${formatTR(today())}`,
    '',
  ];

  if (byPatient.size === 0) {
    lines.push('Şu an acil yazdırılması veya yenilenmesi gereken ilaç/rapor bulunmuyor.');
    lines.push('');
    lines.push('— İlaç Takip uygulamasından paylaşıldı');
    return lines.join('\n');
  }

  for (const [pid, pLines] of byPatient.entries()) {
    const p = patientMap.get(pid);
    const age = p?.birthYear ? ` (${new Date().getFullYear() - p.birthYear} yaş)` : '';
    lines.push(`👤 ${p?.fullName ?? 'Hasta'}${age}:`);
    lines.push(...pLines);
    lines.push('');
  }

  lines.push('— İlaç Takip uygulamasından paylaşıldı');
  return lines.join('\n');
}
