/**
 * Historical relative date labels (e.g. "Just now" or "Last week") were
 * persisted by early Preview builds. They cannot be reconstructed into
 * trustworthy timestamps, so never pretend they are still current.
 *
 * All new interactions store ISO-8601 UTC instants in the existing string
 * field to remain compatible with the saved people-v1 schema.
 */
const ISO_TIMESTAMP_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function formatInteractionDate(value?: string): string {
  if (!value || !ISO_TIMESTAMP_WITH_ZONE.test(value)) return 'Date not recorded';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date not recorded';

  return (
    date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }) +
    ' · ' +
    date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
  );
}

export function createInteractionTimestamp(now: Date = new Date()): string {
  return now.toISOString();
}
