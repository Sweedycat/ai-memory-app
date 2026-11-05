import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';

import type { Aes256GcmBackupCipher } from './encryptedBackupEnvelope';

/**
 * SDK 57 native AES-256-GCM bridge. No files, cloud services, network calls,
 * AsyncStorage or sensitive diagnostics. Not used by the UI until we have a
 * reviewed, user-acknowledged cross-device key recovery flow.
 *
 * The caller is responsible for never storing recoveryKeyHex alongside an
 * exported backup. Do not print, log or send it to our servers.
 */
export async function generateBackupRecoveryKey(): Promise<string> {
  const generated = await AESEncryptionKey.generate(256);
  return generated.encoded('hex');
}

export async function createExpoAesGcmCipher(
  recoveryKeyHex: string,
): Promise<Aes256GcmBackupCipher> {
  // Deliberately require a 256-bit CSPRNG-created recovery key, NOT a user
  // password and NOT a weak, unsalted hash of a password.
  if (!/^[a-fA-F0-9]{64}$/.test(recoveryKeyHex)) {
    throw new Error('A 256-bit recovery key is required');
  }

  const key = await AESEncryptionKey.import(recoveryKeyHex, 'hex');

  return {
    async encryptUtf8ToCombinedBase64(plaintext: string): Promise<string> {
      // Binary input avoids btoa's corruption of non-ASCII Turkish/emoji notes.
      const bytes = new TextEncoder().encode(plaintext);
      const sealed = await aesEncryptAsync(bytes, key, {
        nonce: { length: 12 },
        tagLength: 16,
      });
      const combined = await sealed.combined('base64');
      if (typeof combined !== 'string') {
        throw new Error('AES-GCM failed to encode backup');
      }
      return combined;
    },

    async decryptCombinedBase64ToUtf8(combinedBase64: string): Promise<string> {
      const sealed = AESSealedData.fromCombined(combinedBase64, {
        ivLength: 12,
        tagLength: 16,
      });
      const plaintext = await aesDecryptAsync(sealed, key, { output: 'bytes' });
      if (!(plaintext instanceof Uint8Array)) {
        throw new Error('AES-GCM failed to decode backup');
      }
      return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
    },
  };
}
