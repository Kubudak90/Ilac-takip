// Bildirim planlama saf mantığı (Expo yok) — birim testleri için.
// notifications.ts bu çıktıyı cihaza yazar.

import { Medication, Patient, Settings } from '../types';
import { buildUrgencyList, isDepleted } from './status';
import { addDays, formatTR, startOfDay } from './date';

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
  due: boolean,
): string {
  if (kind === 'stock') {
    return due ? `${name} ilacı bugün bitiyor` : `${name} ilacı bitmek üzere`;
  }
  if (kind === 'report') {
    return due ? `${name} raporu bugün doluyor` : `${name} raporu bitmek üzere`;
  }
  return due
    ? `${name} kutusunun son kullanma tarihi bugün`
    : `${name} kutusunun son kullanma tarihi yaklaşıyor`;
}

/** Susturulmuş hastaların ilaçlarını çıkarır. */
export function medicationsForNotifications(
  patients: Patient[],
  medications: Medication[],
): Medication[] {
  const muted = new Set(
    patients.filter((p) => p.muteNotifications).map((p) => p.id),
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
 * Susturma + bütçe dikkate alınarak planlanacak bildirimleri üretir.
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

  const activeMeds = medicationsForNotifications(patients, medications);
  const patientName = new Map(patients.map((p) => [p.id, p.fullName]));
  const hide = settings.hideSensitiveNotifications;

  const items: PlanItem[] = [];
  const nudgedKeys: string[] = [];
  const nudged = new Set(alreadyNudged);
  let budget = SCHEDULE_BUDGET;
  let dropped = 0;

  // 1) Günlük doz saatleri — saat diliminde birleştir.
  const byTime = new Map<string, { lines: string[]; patientIds: Set<string> }>();
  for (const med of activeMeds) {
    if (!med.doseTimes || med.doseTimes.length === 0) continue;
    if (isDepleted(med)) continue;
    const who = patientName.get(med.patientId) ?? 'Hasta';
    for (const time of med.doseTimes) {
      if (!/^\d{1,2}:\d{2}$/.test(time)) continue;
      const slot = byTime.get(time) ?? { lines: [], patientIds: new Set() };
      slot.lines.push(`${who} — ${med.name}`);
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

  // 2) Stok/rapor/SKT — iki kademe.
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

    const labelSoon = labelFor(item.kind, item.medication.name, false);
    const labelDue = labelFor(item.kind, item.medication.name, true);
    const tail = `${who} — ${formatTR(item.date)}. Reçete/rapor için planlama yapın.`;
    const hidden = 'Bir hatırlatma var — ayrıntı için uygulamayı açın.';
    const baseData = {
      medicationId: item.medication.id,
      patientId: item.medication.patientId,
      kind: item.kind,
    };

    for (const s of [
      { stage: 'pre' as const, when: preWarn, label: labelSoon },
      { stage: 'due' as const, when: dayOf, label: labelDue },
    ]) {
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
