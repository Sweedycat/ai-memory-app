import type { MemoryFollowUp, MemoryInteraction, MemoryPerson } from '../types';
import { interactionInstant } from './interactionDates';

// Display-only: dates are never inferred or persisted. Unknown dates retain
// source order after dated entries; equal instants are stable, including offsets.
function ordered<T>(items: readonly T[], date: (item: T) => string | undefined): T[] {
  return items.map((item, index) => ({ item, index, time: interactionInstant(date(item)) }))
    .sort((a, b) => a.time === null ? b.time === null ? a.index - b.index : 1
      : b.time === null ? -1 : b.time - a.time || a.index - b.index)
    .map(entry => ({ ...entry.item }));
}
function matches(query: string, ...fields: (string | undefined)[]) {
  const q = query.trim().normalize('NFC').toLocaleLowerCase();
  return !q || fields.some(value => value?.normalize('NFC').toLocaleLowerCase().includes(q));
}
export function personHistory(interactions: readonly MemoryInteraction[], completed: readonly MemoryFollowUp[], query = '') {
  return {
    interactions: ordered(interactions.filter(item => matches(query, item.summary, item.date, item.source)), item => item.date),
    completed: ordered(completed.filter(item => matches(query, item.text, item.completedAt)), item => item.completedAt),
  };
}
export function latestDatedInteraction(interactions: readonly MemoryInteraction[]): MemoryInteraction | null {
  let latest: MemoryInteraction | null = null, latestTime = -Infinity;
  for (const interaction of interactions) {
    const time = interactionInstant(interaction.date);
    if (time !== null && time > latestTime) { latest = interaction; latestTime = time; }
  }
  return latest ? { ...latest } : null;
}
export function recentPersonMemory(people: readonly MemoryPerson[]) {
  let result: { person: MemoryPerson; interaction: MemoryInteraction; dated: boolean } | null = null;
  let latestTime = -Infinity;
  for (const person of people) {
    for (const interaction of person.interactions) {
      const time = interactionInstant(interaction.date);
      if (!result) result = { person, interaction, dated: false };
      if (time !== null && time > latestTime) {
        latestTime = time; result = { person, interaction, dated: true };
      }
    }
  }
  return result;
}
