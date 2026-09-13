import { MemoryPerson } from '../types';

export function buildMemoryBriefing(person: MemoryPerson): string {
  const identity = [person.role, person.company].filter(Boolean).join(' at ');
  const latest = person.interactions[0]?.summary;
  const notes = person.notes.slice(0, 2).join(' ');

  const parts = [
    `${person.name}${identity ? ` is ${identity}` : ''}.`,
    person.relationship ? `Context: ${person.relationship}.` : '',
    latest ? `Last conversation: ${latest}` : '',
    notes ? `Remember: ${notes}` : '',
    person.followUp ? `Next step: ${person.followUp.text}.` : '',
  ].filter(Boolean);

  return parts.join(' ');
}
