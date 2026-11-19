import type { MemoryFollowUp, MemoryInteraction, MemoryPerson } from '../types';
import { interactionInstant } from './interactionDates';
import { localLifeDate, validLifeDate, type LifeRecord } from './lifeRecords';

export type Question = 'today' | 'contact' | 'last-interaction' | 'commitments' | 'overdue' | 'upcoming';
export type NoticeCode =
  | 'person-query-required' | 'person-not-found' | 'multiple-people-match'
  | 'no-interactions-recorded' | 'interaction-dates-unknown' | 'newest-interaction-unknown'
  | 'future-interactions-need-review' | 'follow-up-dates-missing' | 'follow-up-dates-invalid'
  | 'life-dates-invalid' | 'life-records-loading' | 'life-records-unavailable'
  | 'follow-ups-not-verified-promises' | 'contact-based-on-saved-follow-ups';
export type AnswerSource = {
  kind: 'interaction' | 'follow-up' | 'life-record';
  id: string;
  personId?: string;
  lifeId?: string;
  title: string;
  text: string;
  date?: string;
  dateKind: 'instant' | 'calendar' | 'missing';
};
export type GroundedAnswer = {
  status: 'results' | 'none' | 'unknown' | 'ambiguous' | 'unavailable';
  sources: AnswerSource[];
  candidates: { id: string; name: string; role?: string; company?: string; relationship: string }[];
  notices: NoticeCode[];
};
export type SavedQuestionInput = {
  question: Question;
  people: readonly MemoryPerson[];
  lifeRecords: readonly LifeRecord[];
  lifeStatus: 'loading' | 'ready' | 'error';
  now: Date;
  personQuery?: string;
  personId?: string;
};

function normalized(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/ı/g, 'i').trim();
}
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function interactionSource(person: MemoryPerson, item: MemoryInteraction): AnswerSource {
  return { kind: 'interaction', id: item.id, personId: person.id, title: person.name,
    text: item.summary, date: item.date, dateKind: interactionInstant(item.date) === null ? 'missing' : 'instant' };
}
function followUpSource(person: MemoryPerson, item: MemoryFollowUp, time: number | null): AnswerSource {
  return { kind: 'follow-up', id: item.id, personId: person.id, title: person.name,
    text: item.text, ...(item.reminderAt === undefined ? {} : { date: item.reminderAt }),
    dateKind: time === null ? 'missing' : 'instant' };
}

function lastInteraction(input: SavedQuestionInput): GroundedAnswer {
  const answer: GroundedAnswer = { status: 'unknown', sources: [], candidates: [], notices: [] };
  const query = normalized(input.personQuery ?? '');
  if (input.personId === undefined && !query) {
    answer.notices.push('person-query-required'); return answer;
  }
  const matches = input.people.filter(person => input.personId !== undefined
    ? person.id === input.personId : normalized(person.name).includes(query));
  if (!matches.length) { answer.notices.push('person-not-found'); return answer; }
  if (matches.length > 1) {
    answer.status = 'ambiguous'; answer.notices.push('multiple-people-match');
    answer.candidates = matches.map(person => ({ id: person.id, name: person.name,
      ...(person.role === undefined ? {} : { role: person.role }),
      ...(person.company === undefined ? {} : { company: person.company }), relationship: person.relationship }));
    return answer;
  }
  const person = matches[0]!;
  if (!person.interactions.length) { answer.notices.push('no-interactions-recorded'); return answer; }
  let latest: MemoryInteraction | undefined;
  let latestTime = -Infinity;
  const uncertain: AnswerSource[] = [];
  for (const item of person.interactions) {
    const time = interactionInstant(item.date);
    if (time === null) {
      if (!answer.notices.includes('interaction-dates-unknown')) {
        answer.notices.push('interaction-dates-unknown', 'newest-interaction-unknown');
      }
      uncertain.push(interactionSource(person, item));
    } else if (time > input.now.getTime()) {
      if (!answer.notices.includes('future-interactions-need-review')) answer.notices.push('future-interactions-need-review');
      uncertain.push(interactionSource(person, item));
    } else if (time > latestTime) { latest = item; latestTime = time; }
  }
  // Unknown/future entries remain inspectable when no past dated interaction exists.
  // They never become a claimed last contact or a guessed call/conversation.
  if (latest) { answer.status = 'results'; answer.sources.push(interactionSource(person, latest)); }
  else answer.sources = uncertain;
  return answer;
}

/**
 * Pure retrieval over the supplied, already-loaded records. Saved text is data,
 * including text that looks like instructions. No storage, Notebook, network,
 * native API, notification scheduling, inference or generated prose is involved.
 */
export function answerSavedQuestion(input: SavedQuestionInput): GroundedAnswer {
  if (!Number.isFinite(input.now.getTime())) throw new Error('Invalid assistant date');
  if (input.question === 'last-interaction') return lastInteraction(input);
  const answer: GroundedAnswer = { status: 'none', sources: [], candidates: [], notices: [] };
  const usesLifeRecords = input.question === 'today' || input.question === 'overdue' || input.question === 'upcoming';
  if (usesLifeRecords && input.lifeStatus !== 'ready') {
    answer.status = 'unavailable';
    answer.notices.push(input.lifeStatus === 'loading' ? 'life-records-loading' : 'life-records-unavailable');
    return answer;
  }
  if (input.question === 'contact') answer.notices.push('contact-based-on-saved-follow-ups');
  if (input.question === 'commitments') answer.notices.push('follow-ups-not-verified-promises');
  const today = localLifeDate(input.now);
  const tomorrow = new Date(input.now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
  // Seven local calendar dates, including remaining today: [now, midnight today+7).
  // setDate preserves true local boundaries through both DST transitions.
  // Derive independently from now: a nonexistent midnight can normalize to 01:00.
  // Carrying that clock from tomorrow would extend a later day's boundary.
  const horizon = new Date(input.now); horizon.setDate(horizon.getDate() + 7); horizon.setHours(0, 0, 0, 0);
  const horizonDate = localLifeDate(horizon);
  const entries: { source: AnswerSource; day: string; time: number }[] = [];
  function notice(code: NoticeCode) { if (!answer.notices.includes(code)) answer.notices.push(code); }
  for (const person of input.people) {
    const item = person.followUp;
    if (!item || item.completedAt !== undefined) continue;
    const time = interactionInstant(item.reminderAt);
    if (time === null) notice(item.reminderAt ? 'follow-up-dates-invalid' : 'follow-up-dates-missing');
    const matches = input.question === 'commitments' || (time !== null && (
      input.question === 'overdue' ? time < input.now.getTime()
        : input.question === 'upcoming' ? time >= input.now.getTime() && time < horizon.getTime()
          : time < tomorrow.getTime()));
    if (matches) entries.push({ source: followUpSource(person, item, time),
      day: time === null ? '9999-99-99' : localLifeDate(new Date(time)), time: time ?? Infinity });
  }
  if (usesLifeRecords) for (const item of input.lifeRecords) {
    if (item.completedAt !== undefined) continue;
    if (!validLifeDate(item.dueDate)) { notice('life-dates-invalid'); continue; }
    const matches = input.question === 'overdue' ? item.dueDate < today
      : input.question === 'upcoming' ? item.dueDate >= today && item.dueDate < horizonDate
        : item.dueDate <= today;
    if (matches) entries.push({ source: { kind: 'life-record', id: item.id, lifeId: item.id,
      title: item.title, text: item.notes, date: item.dueDate, dateKind: 'calendar' }, day: item.dueDate, time: -Infinity });
  }
  entries.sort((a, b) => compare(a.day, b.day) || (a.time === b.time ? 0 : a.time < b.time ? -1 : 1)
    || compare(a.source.kind, b.source.kind) || compare(a.source.personId ?? '', b.source.personId ?? '')
    || compare(a.source.id, b.source.id));
  answer.sources = entries.map(entry => entry.source);
  const datesUnknown = answer.notices.some(code => code === 'follow-up-dates-missing'
    || code === 'follow-up-dates-invalid' || code === 'life-dates-invalid');
  answer.status = answer.sources.length ? 'results' : datesUnknown ? 'unknown' : 'none';
  return answer;
}
