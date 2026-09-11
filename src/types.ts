export type MemorySource = 'manual' | 'voice' | 'camera' | 'glasses';

export type MemoryInteraction = {
  id: string;
  date: string;
  summary: string;
  source: MemorySource;
};

export type MemoryPerson = {
  id: string;
  name: string;
  role?: string;
  company?: string;
  lastInteraction: string;
  relationship: string;
  notes: string[];
  followUp?: string;
  interactions: MemoryInteraction[];
};
