import type { MemoryPerson } from '../types';

export type DailyFollowUp = {
  personId: string; followUpId: string; name: string; text: string; reminderAt?: string; due?: number;
};
export type DailyBriefing = {
  overdue: DailyFollowUp[]; today: DailyFollowUp[]; upcoming: DailyFollowUp[];
  later: DailyFollowUp[]; unscheduled: DailyFollowUp[]; needsReview: DailyFollowUp[];
};

// Only explicit, valid zoned timestamps can become dates. Legacy relative text
// and calendar rollover such as February 30 must never become invented dates.
function timestamp(value: string): number | null {
  if (value.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const calendar = new Date(value.slice(0, 10) + 'T00:00:00.000Z');
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value.slice(0, 10) ||
      Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return null;
  const due = Date.parse(value);
  return Number.isFinite(due) ? due : null;
}

// Read-only deterministic summary of saved follow-ups. No AI, native notification,
// storage mutation or inferred appointments/renewals. Local calendar boundaries
// use setDate rather than 24-hour arithmetic across daylight-saving transitions.
export function buildDailyBriefing(people: readonly MemoryPerson[], now: Date): DailyBriefing {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid briefing date');
  const tomorrow = new Date(now);
  tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
  const horizon = new Date(tomorrow); horizon.setDate(horizon.getDate() + 7);
  const result: DailyBriefing = { overdue: [], today: [], upcoming: [], later: [], unscheduled: [], needsReview: [] };
  for (const person of people) {
    const followUp = person.followUp;
    if (!followUp || followUp.completedAt) continue;
    const item: DailyFollowUp = { personId: person.id, followUpId: followUp.id,
      name: person.name, text: followUp.text, reminderAt: followUp.reminderAt };
    if (!followUp.reminderAt) { result.unscheduled.push(item); continue; }
    const due = timestamp(followUp.reminderAt);
    if (due === null) { result.needsReview.push(item); continue; }
    item.due = due;
    if (due < now.getTime()) result.overdue.push(item);
    else if (due < tomorrow.getTime()) result.today.push(item);
    else if (due < horizon.getTime()) result.upcoming.push(item);
    else result.later.push(item);
  }
  for (const entries of Object.values(result)) entries.sort((a, b) =>
    (a.due ?? Infinity) - (b.due ?? Infinity) || a.personId.localeCompare(b.personId));
  return result;
}
