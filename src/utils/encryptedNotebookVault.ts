import type { Aes256GcmBackupCipher } from './encryptedBackupEnvelope';
import type { NotebookVault } from './notebookSession';
import { decodePersonalNotebook } from './personalNotebook';

// Only a durable atomic backend may implement this interface.
// A notebook-specific key must be supplied by reviewed key management.
export interface NotebookCiphertextStore {
  read(): Promise<string | null>;
  replaceAtomically(ciphertext: string): Promise<void>;
}
const KIND = 'ai-memory-notebook-v1';
const MAX_CIPHERTEXT = 24000000;

function verifyCiphertext(value: unknown): string {
  if (typeof value !== 'string' || value.length < 40 ||
      value.length > MAX_CIPHERTEXT || value.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('Invalid notebook ciphertext');
  }
  return value;
}

export function createEncryptedNotebookVault(
  store: NotebookCiphertextStore,
  cipher: Aes256GcmBackupCipher,
): NotebookVault {
  return {
    async readAuthenticated() {
      const raw = await store.read();
      if (raw === null) return null;
      const plaintext = await cipher.decryptCombinedBase64ToUtf8(verifyCiphertext(raw));
      const prefix = KIND + '\n';
      if (!plaintext.startsWith(prefix)) throw new Error('Invalid notebook payload');
      return JSON.stringify(decodePersonalNotebook(plaintext.slice(prefix.length)));
    },
    async replaceAuthenticated(raw) {
      const canonical = JSON.stringify(decodePersonalNotebook(raw));
      const sealed = verifyCiphertext(await cipher.encryptUtf8ToCombinedBase64(KIND + '\n' + canonical));
      await store.replaceAtomically(sealed);
    },
  };
}
