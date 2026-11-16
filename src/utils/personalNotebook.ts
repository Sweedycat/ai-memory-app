// Pure notebook model. No storage, network, AI access or side effects.
export type PersonalNote = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export const MAX_NOTES = 1000;
export const MAX_NOTE_TITLE = 200;
export const MAX_NOTE_BODY = 20000;
export const MAX_NOTEBOOK_SIZE = 4000000;

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

// Reject the entire payload on corruption; never silently discard notes.
export function decodePersonalNotebook(raw: string): PersonalNote[] {
  if (raw.length > MAX_NOTEBOOK_SIZE) throw new Error('Notebook too large');
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > MAX_NOTES) throw new Error('Invalid notebook');
  const ids = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid note');
    const n = entry as Record<string, unknown>;
    const { id, title, body, createdAt, updatedAt } = n;
    if (typeof id !== 'string' || !id.trim() || id.length > 128 || ids.has(id) ||
        typeof title !== 'string' || title.length > MAX_NOTE_TITLE ||
        typeof body !== 'string' || body.length > MAX_NOTE_BODY ||
        (!title.trim() && !body.trim()) ||
        !validDate(createdAt) || !validDate(updatedAt) || updatedAt < createdAt) {
      throw new Error('Invalid note');
    }
    ids.add(id);
    return { id, title, body, createdAt, updatedAt };
  });
}

export function searchPersonalNotebook(notes: readonly PersonalNote[], query: string): PersonalNote[] {
  const q = query.trim().normalize('NFC').toLocaleLowerCase();
  return notes.filter(n => !q ||
    (n.title + '\n' + n.body).normalize('NFC').toLocaleLowerCase().includes(q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
