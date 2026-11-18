export const personHistoryEn = {
  title: 'History', completed: 'Completed follow-ups', search: 'Search this person’s history',
  order: 'Dated records appear newest first. Undated records keep their saved order.',
  noInteractions: 'No interactions yet.', noCompleted: 'No completed follow-ups.', noMatches: 'No matching history.',
  moreInteractions: 'Show more interactions', moreCompleted: 'Show more completed follow-ups',
  latest: 'Latest dated interaction: ', unknownDate: 'Date not recorded',
  recentDated: 'LATEST DATED MEMORY', recentUndated: 'UNDATED MEMORY',
  count: (shown: number, matches: number, total: number) => `${shown} shown · ${matches} matching · ${total} saved`,
  original: (value: string) => `Original date label: ${value.slice(0, 100)}`,
  source: (value: string) => `Source: ${value}`,
} as const;
