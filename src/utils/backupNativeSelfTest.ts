import type { MemoryPerson } from '../types';
import {
  sealBackupInMemory,
  unsealBackupForReview,
} from './encryptedBackupEnvelope';
import {
  createExpoAesGcmCipher,
  generateBackupRecoveryKey,
} from './expoBackupCipher';

/**
 * Explicit on-device synthetic self-test for Expo SDK 57's native AES-GCM.
 * No real profile/person data, file I/O, OAuth, network, clipboard or logs.
 * This is a QA gate, NOT proof that cloud backup/restore is ready.
 */
export async function runSyntheticBackupCryptoSelfTest(): Promise<void> {
  const createdAt = '2026-11-12T00:00:00.000Z';
  const syntheticPerson: MemoryPerson = {
    id: 'synthetic-person-qa-01',
    name: 'Synthetic Test Person',
    role: 'Tester',
    company: 'Synthetic Company',
    phone: '+1 202 555 0100',
    relationship: 'Synthetic only',
    lastInteraction: createdAt,
    notes: ['Türkçe: Şifreli not ✅ — synthetic data only'],
    interactions: [{
      id: 'synthetic-interaction-qa-01',
      date: createdAt,
      summary: 'Non-personal QA memory',
      source: 'manual',
    }],
    followUp: {
      id: 'synthetic-reminder-qa-01',
      text: 'Synthetic reminder',
      createdAt,
      reminderAt: '2027-01-01T00:00:00.000Z',
      notificationId: 'must-not-export-notification-id',
    },
  };
  const owner = { name: 'Synthetic Owner', preferredName: 'QA', role: 'Tester' };

  const recoveryKey = await generateBackupRecoveryKey();
  const cipher = await createExpoAesGcmCipher(recoveryKey);
  const sealed = await sealBackupInMemory(
    { owner, people: [syntheticPerson], createdAt },
    cipher,
  );

  const serialized = JSON.stringify(sealed);
  if (serialized.includes(syntheticPerson.name) ||
    serialized.includes(syntheticPerson.notes[0]) ||
    serialized.includes(syntheticPerson.phone ?? '')) {
    throw new Error('Backup safety check failed');
  }

  const review = await unsealBackupForReview(sealed, [], cipher);
  if (review.status !== 'review-required' ||
    review.incomingPeople !== 1 ||
    review.candidatePeople[0]?.notes[0] !== syntheticPerson.notes[0] ||
    review.candidatePeople[0]?.phone !== syntheticPerson.phone ||
    review.candidatePeople[0]?.followUp?.notificationId !== undefined) {
    throw new Error('Backup safety check failed');
  }

  const wrongKey = (recoveryKey[0] === 'a' ? 'b' : 'a') + recoveryKey.slice(1);
  const wrongCipher = await createExpoAesGcmCipher(wrongKey);
  let rejectedWrongKey = false;
  try {
    await unsealBackupForReview(sealed, [], wrongCipher);
  } catch {
    rejectedWrongKey = true;
  }
  if (!rejectedWrongKey) throw new Error('Backup safety check failed');

  const first = sealed.encryptedPayload[20] || 'A';
  const flipped = first === 'A' ? 'B' : 'A';
  const tampered = {
    ...sealed,
    encryptedPayload: sealed.encryptedPayload.slice(0, 20) +
      flipped + sealed.encryptedPayload.slice(21),
  };
  let rejectedTamperedFile = false;
  try {
    await unsealBackupForReview(tampered, [], cipher);
  } catch {
    rejectedTamperedFile = true;
  }
  if (!rejectedTamperedFile) throw new Error('Backup safety check failed');
}
