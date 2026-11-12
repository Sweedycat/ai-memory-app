import type { MemoryFollowUp, MemoryPerson } from '../types';
import { normalizeStoredPeople } from './normalizeStoredPeople';

/**
 * Internal, UNENCRYPTED data representation.
 *
 * NEVER write this object to a file, AsyncStorage, cloud storage, logs,
 * telemetry or a share sheet. A future reviewed encryption adapter must
 * seal it with authenticated encryption before any external persistence.
 */
export const BACKUP_SNAPSHOT_KIND = 'ai-memory-private-snapshot';
export const BACKUP_SNAPSHOT_VERSION = 1;
export const MAX_SNAPSHOT_CHARACTERS = 8_000_000;
export const MAX_SNAPSHOT_PEOPLE = 10_000;

export type BackupOwnerProfile = {
  name: string;
  preferredName: string;
  role: string;
};

export type BackupSnapshotV1 = {
  kind: typeof BACKUP_SNAPSHOT_KIND;
  version: typeof BACKUP_SNAPSHOT_VERSION;
  createdAt: string;
  owner: BackupOwnerProfile;
  people: MemoryPerson[];
};

export type RestoreReview = {
  status: 'review-required';
  createdAt: string;
  incomingPeople: number;
  existingPeople: number;
  matchingPersonIds: number;
  requiresReminderRescheduling: boolean;
  /**
   * Intentionally NOT applied to local storage. This is an in-memory,
   * independent copy for a future explicit-approval restore transaction.
   */
  candidatePeople: MemoryPerson[];
  candidateOwner: BackupOwnerProfile;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validIsoDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function validateOwner(value: unknown): BackupOwnerProfile {
  const owner = asRecord(value);
  if (
    !owner ||
    typeof owner.name !== 'string' ||
    !owner.name.trim() ||
    typeof owner.preferredName !== 'string' ||
    typeof owner.role !== 'string'
  ) {
    throw new Error('Backup owner profile has an invalid format');
  }

  return {
    name: owner.name.trim(),
    preferredName: owner.preferredName.trim(),
    role: owner.role.trim(),
  };
}

function removeDeviceNotificationId(value: MemoryFollowUp): MemoryFollowUp {
  return {
    id: value.id,
    text: value.text,
    createdAt: value.createdAt,
    ...(value.reminderAt === undefined ? {} : { reminderAt: value.reminderAt }),
    ...(value.completedAt === undefined ? {} : { completedAt: value.completedAt }),
    // notificationId belongs to the original phone, never to a portable backup.
  };
}

function copyPortablePerson(person: MemoryPerson): MemoryPerson {
  return {
    id: person.id,
    name: person.name,
    ...(person.role === undefined ? {} : { role: person.role }),
    ...(person.company === undefined ? {} : { company: person.company }),
    ...(person.phone === undefined ? {} : { phone: person.phone }),
    lastInteraction: person.lastInteraction,
    relationship: person.relationship,
    notes: [...person.notes],
    ...(person.followUp ? { followUp: removeDeviceNotificationId(person.followUp) } : {}),
    followUpHistory: (person.followUpHistory ?? []).map(removeDeviceNotificationId),
    interactions: person.interactions.map((item) => ({
      id: item.id,
      date: item.date,
      summary: item.summary,
      source: item.source,
    })),
  };
}

function validatePeople(value: unknown): MemoryPerson[] {
  if (!Array.isArray(value) || value.length > MAX_SNAPSHOT_PEOPLE) {
    throw new Error('Backup people list is missing or too large');
  }

  // The backup schema only accepts normalized person objects. Legacy text
  // follow-ups have no stable identity and must be migrated by the existing
  // local-store decoder before preparing a backup.
  for (const raw of value) {
    const item = asRecord(raw);
    if (!item || typeof item.followUp === 'string') {
      throw new Error('Backup contains an unsupported legacy person record');
    }
  }

  const normalized = normalizeStoredPeople(value);
  if (normalized === null) throw new Error('Backup people records failed validation');

  const ids = new Set<string>();
  for (const person of normalized) {
    if (!person.id.trim() || !person.name.trim() || ids.has(person.id)) {
      throw new Error('Backup has missing or duplicated person identities');
    }
    ids.add(person.id);

    const interactionIds = new Set<string>();
    for (const interaction of person.interactions) {
      if (!interaction.id.trim() || interactionIds.has(interaction.id)) {
        throw new Error('Backup has missing or duplicated interaction identities');
      }
      interactionIds.add(interaction.id);
    }

    const followUps = [
      ...(person.followUp ? [person.followUp] : []),
      ...(person.followUpHistory ?? []),
    ];
    const followUpIds = new Set<string>();
    for (const followUp of followUps) {
      if (!followUp.id.trim() || followUpIds.has(followUp.id)) {
        throw new Error('Backup has missing or duplicated follow-up identities');
      }
      followUpIds.add(followUp.id);
    }
  }

  // Project known fields only. Future unknown fields cannot accidentally
  // leak into backup payloads via object spreading.
  return normalized.map(copyPortablePerson);
}

function assertWithinSnapshotLimit(value: unknown): void {
  const encoded = JSON.stringify(value);
  if (encoded === undefined || encoded.length > MAX_SNAPSHOT_CHARACTERS) {
    throw new Error('Backup snapshot exceeds the supported size');
  }
}

/**
 * Build a portable *in-memory* snapshot from already restored/validated
 * local records. This function DOES NOT encrypt, export or upload anything.
 */
export function prepareInMemoryBackupSnapshot(input: {
  owner: BackupOwnerProfile;
  people: MemoryPerson[];
  createdAt?: string;
}): BackupSnapshotV1 {
  const snapshot: BackupSnapshotV1 = {
    kind: BACKUP_SNAPSHOT_KIND,
    version: BACKUP_SNAPSHOT_VERSION,
    createdAt: input.createdAt ?? new Date().toISOString(),
    owner: validateOwner(input.owner),
    people: validatePeople(input.people),
  };
  if (!validIsoDate(snapshot.createdAt)) throw new Error('Backup creation time is invalid');
  assertWithinSnapshotLimit(snapshot);
  return snapshot;
}

/**
 * Call this only AFTER a future authenticated decryption step has succeeded.
 * Syntactic validation alone cannot prove integrity or authenticity.
 */
export function validateDecryptedBackupSnapshot(value: unknown): BackupSnapshotV1 {
  assertWithinSnapshotLimit(value);
  const snapshot = asRecord(value);
  if (
    !snapshot ||
    snapshot.kind !== BACKUP_SNAPSHOT_KIND ||
    snapshot.version !== BACKUP_SNAPSHOT_VERSION ||
    !validIsoDate(snapshot.createdAt)
  ) {
    throw new Error('Backup version or format is unsupported');
  }

  return {
    kind: BACKUP_SNAPSHOT_KIND,
    version: BACKUP_SNAPSHOT_VERSION,
    createdAt: snapshot.createdAt,
    owner: validateOwner(snapshot.owner),
    people: validatePeople(snapshot.people),
  };
}

/**
 * Fail-safe review step. This NEVER writes, deletes, merges or replaces data.
 * Real restore needs user confirmation, durable pre-restore rollback and
 * explicit re-scheduling of future alarms before any activation.
 */
export function planRestoreForReview(
  decryptedSnapshot: unknown,
  existingPeople: MemoryPerson[],
): RestoreReview {
  const backup = validateDecryptedBackupSnapshot(decryptedSnapshot);
  const current = validatePeople(existingPeople);
  const existingIds = new Set(current.map((person) => person.id));

  return {
    status: 'review-required',
    createdAt: backup.createdAt,
    incomingPeople: backup.people.length,
    existingPeople: current.length,
    matchingPersonIds: backup.people.filter((person) => existingIds.has(person.id)).length,
    requiresReminderRescheduling: backup.people.some(
      (person) => person.followUp?.reminderAt !== undefined,
    ),
    candidatePeople: backup.people.map(copyPortablePerson),
    candidateOwner: { ...backup.owner },
  };
}
