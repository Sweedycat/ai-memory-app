import type { MemoryFollowUp, MemoryInteraction, MemoryPerson } from '../types';

type LegacyPerson = Omit<MemoryPerson, 'followUp'> & {
  followUp?: MemoryFollowUp | string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validInteraction(value: unknown): value is MemoryInteraction {
  const item = record(value);
  return Boolean(
    item &&
      typeof item.id === 'string' &&
      typeof item.date === 'string' &&
      typeof item.summary === 'string' &&
      (item.source === 'manual' ||
        item.source === 'voice' ||
        item.source === 'camera' ||
        item.source === 'glasses'),
  );
}

function validFollowUp(value: unknown): boolean {
  if (value === undefined || value === null || typeof value === 'string') return true;
  const item = record(value);
  return Boolean(
    item &&
      typeof item.id === 'string' &&
      typeof item.text === 'string' &&
      (item.createdAt === undefined || typeof item.createdAt === 'string') &&
      (item.reminderAt === undefined || typeof item.reminderAt === 'string') &&
      (item.notificationId === undefined || typeof item.notificationId === 'string') &&
      (item.completedAt === undefined || typeof item.completedAt === 'string'),
  );
}

function validPerson(value: unknown): value is LegacyPerson {
  const person = record(value);
  return Boolean(
    person &&
      typeof person.id === 'string' &&
      typeof person.name === 'string' &&
      typeof person.lastInteraction === 'string' &&
      typeof person.relationship === 'string' &&
      (person.role === undefined || typeof person.role === 'string') &&
      (person.company === undefined || typeof person.company === 'string') &&
      Array.isArray(person.notes) &&
      person.notes.every((note: unknown) => typeof note === 'string') &&
      Array.isArray(person.interactions) &&
      person.interactions.every(validInteraction) &&
      validFollowUp(person.followUp) &&
      (person.followUpHistory === undefined ||
        (Array.isArray(person.followUpHistory) &&
          person.followUpHistory.every(validFollowUp))),
  );
}

function normalizeFollowUp(value: MemoryFollowUp | string | undefined): MemoryFollowUp | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return undefined;

    return {
      id: `follow-up-migrated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      createdAt: new Date().toISOString(),
    };
  }

  if (!value.text?.trim()) return undefined;

  return {
    ...value,
    text: value.text.trim(),
    createdAt: value.createdAt || new Date().toISOString(),
  };
}

// Reject the entire record set rather than silently losing unrecognized records.
export function normalizeStoredPeople(value: unknown): MemoryPerson[] | null {
  if (!Array.isArray(value) || !value.every(validPerson)) return null;

  return value.map((person: LegacyPerson): MemoryPerson => ({
    ...person,
    followUp: normalizeFollowUp(person.followUp),
    followUpHistory: Array.isArray(person.followUpHistory) ? person.followUpHistory : [],
  }));
}

export function decodeStoredPeople(raw: string): MemoryPerson[] {
  const people = normalizeStoredPeople(JSON.parse(raw) as unknown);
  if (people === null) throw new Error('Saved memories have an unsupported or invalid format');
  return people;
}
