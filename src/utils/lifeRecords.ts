/** Date-only responsibilities. No notification identifiers or native scheduling. */
export const CATEGORIES = [
  'vehicle-inspection', 'insurance', 'maintenance', 'bill', 'appointment',
  'document', 'personal-date', 'other',
] as const;

export const LIFE_LIMITS = {
  records: 500, id: 128, title: 160, notes: 4000, history: 100,
  // Bounds JSON parsing/stringification and both snapshots, in UTF-16 code units.
  documentCharacters: 4 * 1024 * 1024,
} as const;

export type LifeCategory = typeof CATEGORIES[number];
export type LifeCompletion = { dueDate: string; completedAt: string };
export type LifeRecord = {
  id: string;
  title: string;
  category: LifeCategory;
  dueDate: string;
  notes: string;
  recurring: boolean;
  completedAt?: string;
  history: LifeCompletion[];
};

export function validLifeDate(value: string): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1]!;
}

export function localLifeDate(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid life date');
  const value = `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (!validLifeDate(value)) throw new Error('Invalid life date');
  return value;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  return required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
}

function timestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  if (!validLifeDate(value.slice(0, 10))) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function text(value: unknown, max: number, required = false): value is string {
  return typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
}

/** Reject the entire record; never salvage or silently discard unsupported fields. */
export function validateLifeRecord(value: unknown): LifeRecord {
  if (!object(value) || !keys(value, ['id', 'title', 'category', 'dueDate', 'notes', 'recurring', 'history'], ['completedAt'])
    || !text(value.id, LIFE_LIMITS.id, true) || !text(value.title, LIFE_LIMITS.title, true)
    || !CATEGORIES.includes(value.category as LifeCategory)
    || typeof value.dueDate !== 'string' || !validLifeDate(value.dueDate)
    || !text(value.notes, LIFE_LIMITS.notes) || typeof value.recurring !== 'boolean'
    || (value.completedAt !== undefined && !timestamp(value.completedAt))
    || !Array.isArray(value.history) || value.history.length > LIFE_LIMITS.history) {
    throw new Error('Invalid life record');
  }
  const history = value.history.map(item => {
    if (!object(item) || !keys(item, ['dueDate', 'completedAt'])
      || typeof item.dueDate !== 'string' || !validLifeDate(item.dueDate) || !timestamp(item.completedAt)) {
      throw new Error('Invalid life history');
    }
    return { dueDate: item.dueDate, completedAt: item.completedAt };
  });
  return {
    id: value.id, title: value.title, category: value.category as LifeCategory,
    dueDate: value.dueDate, notes: value.notes, recurring: value.recurring,
    ...(value.completedAt === undefined ? {} : { completedAt: value.completedAt as string }), history,
  };
}

export function validateLifeRecords(value: unknown): LifeRecord[] {
  if (!Array.isArray(value) || value.length > LIFE_LIMITS.records) throw new Error('Invalid life records');
  const ids = new Set<string>();
  return value.map(item => {
    const record = validateLifeRecord(item);
    if (ids.has(record.id)) throw new Error('Duplicate life record');
    ids.add(record.id);
    return record;
  });
}

export function completeLifeRecord(base: LifeRecord, now: Date, nextDate: string | null): LifeRecord {
  const record = validateLifeRecord(base);
  const today = localLifeDate(now);
  const completedAt = now.toISOString();
  if (!timestamp(completedAt) || record.completedAt !== undefined || record.history.length >= LIFE_LIMITS.history) {
    throw new Error('Life record cannot be completed');
  }
  if (nextDate !== null && (!record.recurring || !validLifeDate(nextDate) || nextDate <= record.dueDate || nextDate <= today)) {
    throw new Error('Invalid next life date');
  }
  const history = [...record.history, { dueDate: record.dueDate, completedAt }];
  if (nextDate === null) return { ...record, completedAt, history };
  return { ...record, dueDate: nextDate, history };
}

function normalized(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/ı/g, 'i').trim();
}

export function lifeAgenda(records: readonly LifeRecord[], now: Date, query = '', categoryLabels: Partial<Record<LifeCategory, string>> = {}): {
  overdue: LifeRecord[]; today: LifeRecord[]; upcoming: LifeRecord[]; completed: LifeRecord[];
} {
  const today = localLifeDate(now);
  const needle = normalized(query);
  const result: ReturnType<typeof lifeAgenda> = { overdue: [], today: [], upcoming: [], completed: [] };
  const sorted = [...records].sort((a, b) => a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const record of sorted) {
    if (needle && !normalized(`${record.title}\n${record.notes}\n${record.category}\n${categoryLabels[record.category] ?? ''}\n${record.dueDate}`).includes(needle)) continue;
    if (record.completedAt !== undefined) result.completed.push(record);
    else if (record.dueDate < today) result.overdue.push(record);
    else if (record.dueDate === today) result.today.push(record);
    else result.upcoming.push(record);
  }
  return result;
}
