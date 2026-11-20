import { generatedCopy } from '../i18n/catalogs/generated';

/**
 * Historical relative date labels (e.g. "Just now" or "Last week") were
 * persisted by early Preview builds. They cannot be reconstructed into
 * trustworthy timestamps, so never pretend they are still current.
 *
 * All new interactions store ISO-8601 UTC instants in the existing string
 * field to remain compatible with the saved people-v1 schema.
 */
const ISO_TIMESTAMP_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export function interactionInstant(value?: string): number | null {
  if (!value || value.length > 48 || !ISO_TIMESTAMP_WITH_ZONE.test(value)) return null;
  const day = new Date(value.slice(0, 10) + 'T00:00:00.000Z');
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value.slice(0, 10) ||
      Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function formatInteractionDate(value?: string, locale?: string): string {
  const instant = interactionInstant(value);
  const copy = generatedCopy(locale);
  if (instant === null) return copy.unknownDate;
  const date = new Date(instant);

  return copy.dateTime(
    date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    })
  );
}

export function createInteractionTimestamp(now: Date = new Date()): string {
  return now.toISOString();
}
