// Translation-ready copy; no unreviewed Turkish catalog is activated.
export const dailyBriefingEn = {
  title: 'Your daily overview',
  source: 'From your follow-ups.',
  overdue: 'Overdue', today: 'Still due today', upcoming: 'Next 7 days',
  unscheduled: 'No date', later: 'Later', needsReview: 'Date needs review',
  empty: 'No open follow-ups. Add one from a person profile.',
  dateMissing: 'No reminder date set',
  reviewCount: (count: number) => `${count} reminder ${count === 1 ? 'date needs' : 'dates need'} review.`,
  showing: (visible: number, total: number) => `Showing ${visible} of ${total} open follow-ups.`,
  open: (name: string) => `Open follow-up for ${name}`,
} as const;
