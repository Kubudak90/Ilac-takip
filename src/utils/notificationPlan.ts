// Bildirim planlama saf mantığı (Expo yok) — birim testleri için.
// notifications.ts bu çıktıyı cihaza yazar.

import { Medication, Patient, Settings } from '../types';
import { buildUrgencyList, isDepleted, isExpired } from './status';
import { isMedicationActiveOnDay, mealRelationLabel } from './adherence';
import { addDays, formatTR, parseISO, startOfDay, toDayKey } from './date';

/** iOS bekleyen bildirim üst sınırı 64; güvenli pay. */
export const SCHEDULE_BUDGET = 58;

export type PlanTrigger =
  | { type: 'daily'; hour: number; minute: number }
  | { type: 'date'; when: Date }
  | { type: 'soon'; seconds: number };

export interface PlanItem {
  key: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  trigger: PlanTrigger;
}

export interface PlanResult {
  items: PlanItem[];
  dropped: number;
  nudgedKeys: string[];
}

function labelFor(
  kind: 'stock' | 'report' | 'expiry',
  name: string,
  stage: 'early30' | 'pre' | 'due',
): string {
  if (kind === 'stock') {
    return stage === 'due'
      ? `${name} ilacı bugün bitiyor`
      : `${name} ilacı bitmek üzere`;
  }
  if (kind === 'report') {
    return stage === 'due'
      ? `${name} raporu bugün doluyor`
      : `${name} raporu bitmek üzere`;
  }
  if (stage === 'early30') {
    return `${name} kutusunun son kullanma tarihine 30 gün kaldı`;
  }
  return stage === 'due'
    ? `${name} kutusunun son kullanma tarihi bugün`
    : `${name} kutusunun son kullanma tarihi yaklaşıyor`;
}

/** Hastanın bildirimleri şu an geçici olarak ertelenmiş (snooze) mi? */
export function isPatientSnoozed(
  patient: Patient,
  now: Date = new Date(),
): boolean {
  if (!patient.snoozeUntil) return false;
  const until = parseISO(patient.snoozeUntil);
  return Number.isFinite(until.getTime()) && until.getTime() > now.getTime();
}

/** Susturulmuş veya geçici ertelenmiş hastaların ilaçlarını çıkarır. */
export function medicationsForNotifications(
  patients: Patient[],
  medications: Medication[],
  now: Date = new Date(),
): Medication[] {
  const muted = new Set(
    patients
      .filter((p) => p.muteNotifications || isPatientSnoozed(p, now))
      .map((p) => p.id),
  );
  return medications.filter((m) => !muted.has(m.patientId));
}

/**
 * Tek seferlik tetikleyici.
 * Gelecek → date; aynı gün geçmiş saat → soon (oturumda 1 kez); geçmiş gün → null.
 */
export function oneshotTrigger(
  when: Date,
  now: Date,
  key: string,
  alreadyNudged: Set<string>,
): { trigger: PlanTrigger; nudgeKey?: string } | null {
  if (when.getTime() > now.getTime()) {
    return { trigger: { type: 'date', when } };
  }
  const sameDay = startOfDay(when).getTime() === startOfDay(now).getTime();
  const sessionKey = `${key}:${startOfDay(when).toISOString().slice(0, 10)}`;
  if (sameDay && !alreadyNudged.has(sessionKey)) {
    return { trigger: { type: 'soon', seconds: 60 }, nudgeKey: sessionKey };
  }
  return null;
}

/**
 * Susturma + erteleme + bütçe dikkate alınarak planlanacak bildirimleri üretir.
 */
export function planNotifications(
  patients: Patient[],
  medications: Medication[],
  settings: Settings,
  now: Date = new Date(),
  alreadyNudged: Set<string> = new Set(),
): PlanResult {
  if (!settings.notificationsEnabled) {
    return { items: [], dropped: 0, nudgedKeys: [] };
  }

  const activeMeds = medicationsForNotifications(patients, medications, now);
  const patientName = new Map(patients.map((p) => [p.id, p.fullName]));
  const hide = settings.hideSensitiveNotifications;
  const currentDayKey = toDayKey(now);

  const items: PlanItem[] = [];
  const nudgedKeys: string[] = [];
  const nudged = new Set(alreadyNudged);
  let budget = SCHEDULE_BUDGET;
  let dropped = 0;

  // 1) Günlük doz saatleri — saat diliminde birleştir (o gün aktif olan ilaçlar).
  const byTime = new Map<string, { lines: string[]; patientIds: Set<string> }>();
  for (const med of activeMeds) {
    if (!med.doseTimes || med.doseTimes.length === 0) continue;
    if (isDepleted(med)) continue;
    if (!isMedicationActiveOnDay(med, currentDayKey)) continue;
    const who = patientName.get(med.patientId) ?? 'Hasta';
    const meal = mealRelationLabel(med.mealRelation);
    const medLine = meal ? `${who} — ${med.name} (${meal})` : `${who} — ${med.name}`;
    for (const time of med.doseTimes) {
      if (!/^\d{1,2}:\d{2}$/.test(time)) continue;
      const slot = byTime.get(time) ?? { lines: [], patientIds: new Set() };
      slot.lines.push(medLine);
      slot.patientIds.add(med.patientId);
      byTime.set(time, slot);
    }
  }

  const sortedTimes = [...byTime.keys()].sort();
  for (let ti = 0; ti < sortedTimes.length; ti++) {
    if (budget <= 0) {
      dropped += sortedTimes.length - ti;
      break;
    }
    const time = sortedTimes[ti];
    const [hh, mm] = time.split(':').map((x) => parseInt(x, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
    const slot = byTime.get(time)!;
    const solePatient =
      slot.patientIds.size === 1 ? [...slot.patientIds][0] : undefined;
    items.push({
      key: `dose:${time}`,
      title: `⏰ İlaç saati ${time}`,
      body: hide
        ? `${slot.lines.length} ilaç alınacak — ayrıntı için uygulamayı açın`
        : slot.lines.join('\n'),
      data: {
        kind: 'dose',
        time,
        ...(solePatient ? { patientId: solePatient } : {}),
      },
      trigger: { type: 'daily', hour: hh, minute: mm },
    });
    budget--;
  }

  // 1b) Tükenen ilaçlar — tek günlük eskalasyon.
  const depleted = activeMeds.filter((m) => isDepleted(m));
  if (depleted.length > 0) {
    if (budget <= 0) {
      dropped += 1;
    } else {
      const solePatient =
        new Set(depleted.map((m) => m.patientId)).size === 1
          ? depleted[0].patientId
          : undefined;
      items.push({
        key: 'depleted:daily',
        title: '⚠️ Biten ilaç(lar) — yenileyin',
        body: hide
          ? `${depleted.length} ilaç bitti — ayrıntı için uygulamayı açın`
          : depleted
              .map((m) => `${patientName.get(m.patientId) ?? 'Hasta'} — ${m.name}`)
              .join('\n'),
        data: {
          kind: 'depleted',
          ...(solePatient ? { patientId: solePatient } : {}),
          ...(depleted.length === 1 ? { medicationId: depleted[0].id } : {}),
        },
        trigger: { type: 'daily', hour: settings.reminderHour, minute: 0 },
      });
      budget--;
    }
  }

  // 1c) Son kullanma tarihi geçmiş ilaçlar — günlük uyarı.
  const expired = activeMeds.filter((m) => isExpired(m));
  if (expired.length > 0) {
    if (budget <= 0) {
      dropped += 1;
    } else {
      const solePatient =
        new Set(expired.map((m) => m.patientId)).size === 1
          ? expired[0].patientId
          : undefined;
      items.push({
        key: 'expired:daily',
        title: '⚠️ Son kullanma tarihi geçen ilaç(lar)',
        body: hide
          ? `${expired.length} ilacın son kullanma tarihi geçti — uygulamayı açın`
          : expired
              .map((m) => `${patientName.get(m.patientId) ?? 'Hasta'} — ${m.name}`)
              .join('\n'),
        data: {
          kind: 'expiry',
          ...(solePatient ? { patientId: solePatient } : {}),
          ...(expired.length === 1 ? { medicationId: expired[0].id } : {}),
        },
        trigger: { type: 'daily', hour: settings.reminderHour, minute: 0 },
      });
      budget--;
    }
  }

  // 2) Stok/rapor/SKT — yaklaşan tarih bildirimleri.
  const urgency = buildUrgencyList(activeMeds, settings.warnDaysBefore);
  let urgencyIdx = 0;
  for (; urgencyIdx < urgency.length; urgencyIdx++) {
    if (budget <= 0) break;
    const item = urgency[urgencyIdx];
    const who = patientName.get(item.medication.patientId) ?? 'Hasta';
    const preWarn = new Date(addDays(startOfDay(item.date), -settings.warnDaysBefore));
    preWarn.setHours(settings.reminderHour, 0, 0, 0);
    const dayOf = new Date(startOfDay(item.date));
    dayOf.setHours(settings.reminderHour, 0, 0, 0);

    const stages: { stage: 'early30' | 'pre' | 'due'; when: Date; label: string }[] = [];

    // Son kullanma tarihi için 30 gün önceden erken uyarı (warnDaysBefore < 30 ise)
    if (item.kind === 'expiry' && settings.warnDaysBefore < 30) {
      const early30 = new Date(addDays(startOfDay(item.date), -30));
      early30.setHours(settings.reminderHour, 0, 0, 0);
      stages.push({
        stage: 'early30',
        when: early30,
        label: labelFor(item.kind, item.medication.name, 'early30'),
      });
    }

    stages.push(
      {
        stage: 'pre',
        when: preWarn,
        label: labelFor(item.kind, item.medication.name, 'pre'),
      },
      {
        stage: 'due',
        when: dayOf,
        label: labelFor(item.kind, item.medication.name, 'due'),
      },
    );

    const tail = `${who} — ${formatTR(item.date)}. Reçete/rapor için planlama yapın.`;
    const hidden = 'Bir hatırlatma var — ayrıntı için uygulamayı açın.';
    const baseData = {
      medicationId: item.medication.id,
      patientId: item.medication.patientId,
      kind: item.kind,
    };

    for (const s of stages) {
      if (budget <= 0) break;
      const key = `${item.medication.id}:${item.kind}:${s.stage}`;
      const trig = oneshotTrigger(s.when, now, key, nudged);
      if (!trig) continue;
      if (trig.nudgeKey) {
        nudged.add(trig.nudgeKey);
        nudgedKeys.push(trig.nudgeKey);
      }
      items.push({
        key,
        title: '💊 İlaç Takip Hatırlatması',
        body: hide ? hidden : `${s.label}. ${tail}`,
        data: { ...baseData, stage: s.stage },
        trigger: trig.trigger,
      });
      budget--;
    }
  }
  if (urgencyIdx < urgency.length) {
    dropped += urgency.length - urgencyIdx;
  }

  return { items, dropped, nudgedKeys };
}

