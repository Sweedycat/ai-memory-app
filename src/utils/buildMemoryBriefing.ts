import { MemoryPerson, type MemoryInteraction } from '../types';
import { generatedCopy } from '../i18n/catalogs/generated';
import { formatInteractionDate, interactionInstant } from './interactionDates';

export function buildMemoryBriefing(person: MemoryPerson, now = new Date(), locale = 'en'): string {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid briefing date');
  const copy = generatedCopy(locale).briefing;
  const identity = [person.role, person.company].filter(Boolean).join(copy.identitySeparator);
  let latest: MemoryInteraction | undefined, firstUndated: MemoryInteraction | undefined, firstFuture: MemoryInteraction | undefined;
  let latestTime = -Infinity;
  for (const item of person.interactions) {
    const time = interactionInstant(item.date);
    if (time === null) firstUndated ??= item;
    else if (time > now.getTime()) firstFuture ??= item;
    else if (time > latestTime) { latest = item; latestTime = time; }
  }
  const interaction = latest ? copy.dated(formatInteractionDate(latest.date, locale), latest.summary)
    : firstUndated ? copy.undated(firstUndated.summary)
      : firstFuture ? copy.future(firstFuture.summary) : '';
  const notes = person.notes.slice(0, 2).join(' ');

  const parts = [
    copy.identity(person.name, identity),
    person.relationship ? copy.context(person.relationship) : '',
    interaction,
    firstUndated ? copy.uncertainDates : '',
    firstFuture ? copy.futureReview : '',
    notes ? copy.remember(notes) : '',
    person.followUp && !person.followUp.completedAt ? copy.nextStep(person.followUp.text) : '',
  ].filter(Boolean);

  return parts.join(' ');
}
