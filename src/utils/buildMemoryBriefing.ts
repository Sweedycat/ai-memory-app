import { MemoryPerson, type MemoryInteraction } from '../types';
import { formatInteractionDate, interactionInstant } from './interactionDates';

export function buildMemoryBriefing(person: MemoryPerson, now = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid briefing date');
  const identity = [person.role, person.company].filter(Boolean).join(' at ');
  let latest: MemoryInteraction | undefined, firstUndated: MemoryInteraction | undefined, firstFuture: MemoryInteraction | undefined;
  let latestTime = -Infinity;
  for (const item of person.interactions) {
    const time = interactionInstant(item.date);
    if (time === null) firstUndated ??= item;
    else if (time > now.getTime()) firstFuture ??= item;
    else if (time > latestTime) { latest = item; latestTime = time; }
  }
  const interaction = latest ? `Last dated interaction (${formatInteractionDate(latest.date)}): ${latest.summary}`
    : firstUndated ? `Saved interaction (date not recorded): ${firstUndated.summary}`
      : firstFuture ? `Saved interaction (future date, needs review): ${firstFuture.summary}` : '';
  const notes = person.notes.slice(0, 2).join(' ');

  const parts = [
    `${person.name}${identity ? ` is ${identity}` : ''}.`,
    person.relationship ? `Context: ${person.relationship}.` : '',
    interaction,
    firstUndated ? 'Some interaction dates are not recorded; the latest interaction cannot be confirmed.' : '',
    firstFuture ? 'Future-dated interactions need review.' : '',
    notes ? `Remember: ${notes}` : '',
    person.followUp && !person.followUp.completedAt ? `Next step: ${person.followUp.text}.` : '',
  ].filter(Boolean);

  return parts.join(' ');
}
