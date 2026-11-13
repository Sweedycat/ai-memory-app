import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';

import type { Aes256GcmBackupCipher } from './encryptedBackupEnvelope';

/**
 * Strict UTF-8 decoder fallback for Hermes runtimes without TextDecoder.
 * Rejects malformed, truncated, overlong and surrogate sequences instead of
 * silently corrupting a user's restored notes.
 */
function decodeUtf8Strict(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  const chunks: string[] = [];
  let codePoints: number[] = [];
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i++];
    let codePoint: number;
    let extra = 0;
    let minimum = 0;
    if (first < 0x80) {
      codePoint = first;
    } else if (first >= 0xc2 && first <= 0xdf) {
      codePoint = first & 0x1f; extra = 1; minimum = 0x80;
    } else if (first >= 0xe0 && first <= 0xef) {
      codePoint = first & 0x0f; extra = 2; minimum = 0x800;
    } else if (first >= 0xf0 && first <= 0xf4) {
      codePoint = first & 0x07; extra = 3; minimum = 0x10000;
    } else {
      throw new Error('Invalid UTF-8 in authenticated backup');
    }
    if (i + extra > bytes.length) throw new Error('Truncated UTF-8 in authenticated backup');
    for (let j = 0; j < extra; j++) {
      const continuation = bytes[i++];
      if ((continuation & 0xc0) !== 0x80) throw new Error('Invalid UTF-8 continuation');
      codePoint = (codePoint << 6) | (continuation & 0x3f);
    }
    if (codePoint < minimum || codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      throw new Error('Invalid UTF-8 code point in authenticated backup');
    }
    codePoints.push(codePoint);
    if (codePoints.length === 2048) {
      chunks.push(String.fromCodePoint(...codePoints));
      codePoints = [];
    }
  }
  if (codePoints.length) chunks.push(String.fromCodePoint(...codePoints));
  return chunks.join('');
}

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
      return decodeUtf8Strict(plaintext);
    },
  };
}
