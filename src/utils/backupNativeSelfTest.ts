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
export type BackupCryptoStage = 'key-generation' | 'key-import' | 'encrypt' | 'crypto-decrypt' | 'restore-review' | 'wrong-key' | 'tamper';

export class BackupCryptoSelfTestError extends Error {
  constructor(readonly stage: BackupCryptoStage) {
    super(`Synthetic backup encryption failed at ${stage}`);
    this.name = 'BackupCryptoSelfTestError';
  }
}

/** Only exposes the failed test stage; never the native error, key, or plaintext. */
async function checkStage<T>(stage: BackupCryptoStage, operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch { throw new BackupCryptoSelfTestError(stage); }
}

export async function runSyntheticBackupCryptoSelfTest(): Promise<void> {
  const createdAt = '2026-11-12T00:00:00.000Z';
  const syntheticNote = 'Türkçe: Şifreli not ✅ — synthetic data only';
  const syntheticPerson: MemoryPerson = {
    id: 'synthetic-person-qa-01',
    name: 'Synthetic Test Person',
    role: 'Tester',
    company: 'Synthetic Company',
    phone: '+1 202 555 0100',
    relationship: 'Synthetic only',
    lastInteraction: createdAt,
    notes: [syntheticNote],
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

  const recoveryKey = await checkStage('key-generation', generateBackupRecoveryKey);
  const cipher = await checkStage('key-import', () => createExpoAesGcmCipher(recoveryKey));
  const sealed = await checkStage('encrypt', () => sealBackupInMemory(
    { owner, people: [syntheticPerson], createdAt },
    cipher,
  ));

  const serialized = JSON.stringify(sealed);
  if (serialized.includes(syntheticPerson.name) ||
    serialized.includes(syntheticNote) ||
    serialized.includes(syntheticPerson.phone ?? '')) {
    throw new BackupCryptoSelfTestError('encrypt');
  }

  // Separate native AES/UTF-8 round-trip from snapshot validation so a
  // failing Android crypto bridge cannot be mistaken for a restore schema bug.
  const decryptedJson = await checkStage('crypto-decrypt', () =>
    cipher.decryptCombinedBase64ToUtf8(sealed.encryptedPayload));
  const review = await checkStage('restore-review', () =>
    unsealBackupForReview(sealed, [], cipher));
  if (!decryptedJson.includes(syntheticNote)) {
    throw new BackupCryptoSelfTestError('crypto-decrypt');
  }
  if (review.status !== 'review-required' ||
    review.incomingPeople !== 1 ||
    review.candidatePeople[0]?.notes[0] !== syntheticPerson.notes[0] ||
    review.candidatePeople[0]?.phone !== syntheticPerson.phone ||
    review.candidatePeople[0]?.followUp?.notificationId !== undefined) {
    throw new BackupCryptoSelfTestError('restore-review');
  }

  const wrongKey = (recoveryKey[0] === 'a' ? 'b' : 'a') + recoveryKey.slice(1);
  const wrongCipher = await checkStage('wrong-key', () => createExpoAesGcmCipher(wrongKey));
  let rejectedWrongKey = false;
  try {
    await unsealBackupForReview(sealed, [], wrongCipher);
  } catch {
    rejectedWrongKey = true;
  }
  if (!rejectedWrongKey) throw new BackupCryptoSelfTestError('wrong-key');

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
  if (!rejectedTamperedFile) throw new BackupCryptoSelfTestError('tamper');
}
