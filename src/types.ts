export type MemorySource = 'manual' | 'voice' | 'camera' | 'glasses';

export type MemoryInteraction = {
  id: string;
  date: string;
  summary: string;
  source: MemorySource;
};

export type MemoryFollowUp = {
  id: string;
  text: string;
  createdAt: string;
  reminderAt?: string;
  notificationId?: string;
  completedAt?: string;
};

export type MemoryPerson = {
  id: string;
  name: string;
  role?: string;
  company?: string;
  lastInteraction: string;
  relationship: string;
  notes: string[];
  followUp?: MemoryFollowUp;
  followUpHistory?: MemoryFollowUp[];
  interactions: MemoryInteraction[];
};
