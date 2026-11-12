import type { MemoryPerson } from '../types';
import { sealBackupInMemory, unsealBackupForReview } from './encryptedBackupEnvelope';
import { createExpoAesGcmCipher, generateBackupRecoveryKey } from './expoBackupCipher';

/**
 * Preview-only native Android crypto smoke test. Uses SYNTHETIC data only.
 * No app records, accounts, network requests, files or local storage are read.
 * Keys, ciphertext, and sample notes are never logged or returned to the UI.
 */
export async function runSyntheticBackupCryptoDiagnostic(): Promise<boolean> {
  const createdAt = new Date().toISOString();
  const person: MemoryPerson = {
    id: 'synthetic-backup-test-person',
    name: 'Şifreli Örnek 🧠',
    role: 'Test only',
    company: 'No real contact',
    phone: '+90 500 000 00 00',
    relationship: 'Synthetic contact',
    lastInteraction: createdAt,
    notes: ['Türkçe karakter denemesi: ğüşöçı 🛡️'],
    interactions: [{
      id: 'synthetic-interaction',
      date: createdAt,
      source: 'manual',
      summary: 'Offline encryption test only',
    }],
    followUp: {
      id: 'synthetic-followup',
      text: 'Synthetic reminder — never schedule',
      createdAt,
      reminderAt: createdAt,
      notificationId: 'must-not-migrate',
    },
    followUpHistory: [],
  };
  const owner = {
    name: 'Synthetic Test Owner',
    preferredName: '',
    role: 'Test only',
  };

  const key = await generateBackupRecoveryKey();
  const cipher = await createExpoAesGcmCipher(key);
  const envelope = await sealBackupInMemory({ owner, people: [person], createdAt }, cipher);
  const serialized = JSON.stringify(envelope);
  if (serialized.includes(person.name) || serialized.includes(person.notes[0])) {
    throw new Error('Synthetic backup encryption privacy check failed');
  }

  const review = await unsealBackupForReview(envelope, [], cipher);
  if (review.status !== 'review-required' ||
      review.incomingPeople !== 1 ||
      review.candidatePeople[0]?.name !== person.name ||
      review.candidatePeople[0]?.notes[0] !== person.notes[0] ||
      review.candidatePeople[0]?.phone !== person.phone ||
      review.candidatePeople[0]?.followUp?.notificationId !== undefined) {
    throw new Error('Native backup round-trip validation failed');
  }

  const wrongKey = await generateBackupRecoveryKey();
  const wrongCipher = await createExpoAesGcmCipher(wrongKey);
  let rejected = false;
  try {
    await unsealBackupForReview(envelope, [], wrongCipher);
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error('Backup decryption did not reject the wrong key');

  // True confirms synthetic in-memory round trip only. It does not confirm
  // Google Drive OAuth, upload/download or safe restoration of owner records.
  return true;
}
