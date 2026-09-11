import { MemoryPerson } from '../types';

export const mockPeople: MemoryPerson[] = [
  {
    id: '1',
    name: 'Maya Chen',
    role: 'Product Designer',
    company: 'Northstar Labs',
    lastInteraction: 'Today, 14:20',
    relationship: 'Met at an AI meetup',
    notes: [
      'Interested in wearable AI interfaces',
      'Prefers concise follow-up messages',
      'Building a design system for a mobile product',
    ],
    followUp: 'Send the smart-glasses UX article on Friday',
    interactions: [
      {
        id: 'maya-1',
        date: 'Today, 14:20',
        summary: 'Discussed live context prompts for smart glasses and privacy-first onboarding.',
        source: 'manual',
      },
      {
        id: 'maya-2',
        date: 'Last week',
        summary: 'Met at an AI meetup and exchanged product design notes.',
        source: 'manual',
      },
    ],
  },
  {
    id: '2',
    name: 'Daniel Brooks',
    role: 'Founder',
    company: 'Relay Systems',
    lastInteraction: '2 days ago',
    relationship: 'Potential B2B customer',
    notes: [
      'Wants a lightweight CRM memory layer',
      'Asked about privacy and team permissions',
      'May pilot with a 10-person sales team',
    ],
    followUp: 'Prepare a short B2B demo outline',
    interactions: [
      {
        id: 'daniel-1',
        date: '2 days ago',
        summary: 'Asked about a team pilot, permission controls and how memories can be shared safely.',
        source: 'manual',
      },
    ],
  },
];
