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
      'Building a design system for a mobile product'
    ],
    followUp: 'Send the smart-glasses UX article on Friday'
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
      'May pilot with a 10-person sales team'
    ],
    followUp: 'Prepare a short B2B demo outline'
  }
];
