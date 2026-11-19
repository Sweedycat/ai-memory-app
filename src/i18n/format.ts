import { validLifeDate } from '../utils/lifeRecords';
import { LANGUAGE_LOCALES, type Language } from './language';

export function formatNumber(value: number, language: Language, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) throw new Error('Invalid number');
  return new Intl.NumberFormat(LANGUAGE_LOCALES[language], options).format(value);
}

function instant(value: Date | number): Date {
  if (!(value instanceof Date) && typeof value !== 'number') throw new Error('Expected a date or timestamp');
  const date = new Date(value instanceof Date ? value.getTime() : value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid date');
  return date;
}

export function formatDate(value: Date | number, language: Language,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }): string {
  return new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], options).format(instant(value));
}

export function formatTime(value: Date | number, language: Language,
  options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }): string {
  return new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], options).format(instant(value));
}

type CalendarOptions = Pick<Intl.DateTimeFormatOptions, 'year' | 'month' | 'day' | 'weekday' | 'dateStyle'>;

/** A YYYY-MM-DD is a Gregorian calendar day, never an instant in the device timezone. */
export function formatCalendarDate(value: string, language: Language,
  options: CalendarOptions = { year: 'numeric', month: 'short', day: 'numeric' }): string {
  if (!validLifeDate(value)) throw new Error('Invalid calendar date');
  const date = new Date(`${value}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], {
    ...options, calendar: 'gregory', timeZone: 'UTC',
  }).format(date);
}
