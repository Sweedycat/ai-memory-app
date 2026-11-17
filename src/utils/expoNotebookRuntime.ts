import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { createExpoAesGcmCipher, generateBackupRecoveryKey } from './expoBackupCipher';
import { resolveNotebookKey } from './notebookKeys';
import { openPersistentNotebook, type PersistentNotebook } from './persistentNotebook';
import { NOTEBOOK_DATABASE_NAME, openNotebookDatabase } from './sqliteNotebookDatabase';

const KEY_SLOT = 'ai-memory.notebook.local-key.v1';
const KEY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: 'ai-memory.notebook.local.v1',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  // Existing PrivacyGate controls access. SecureStore encrypts the device-local
  // key without a second, inconsistent biometric prompt per read/write.
  requireAuthentication: false,
};
let live: PersistentNotebook | null = null;
let opening = false;

// Explicit native factory only. No module-level database/key access or fallback.
// Local notebook key is separate from off-device backup recovery keys.
export async function openExpoNotebook() {
  if (opening) throw new Error('Notebook opening');
  opening = true;
  let native: SQLite.SQLiteDatabase | null = null;
  try {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') throw new Error('Notebook platform unsupported');
    if (live) { live.close(); await live.whenIdle(); live = null; }
    if (!await SecureStore.isAvailableAsync()) throw new Error('Notebook key store unavailable');
    native = await SQLite.openDatabaseAsync(NOTEBOOK_DATABASE_NAME, { useNewConnection: true });
    const database = await openNotebookDatabase(native);
    let localKey = await resolveNotebookKey(database, {
      read: () => SecureStore.getItemAsync(KEY_SLOT, KEY_OPTIONS),
      write: value => SecureStore.setItemAsync(KEY_SLOT, value, KEY_OPTIONS),
    }, async () => ({ version: 1, id: Array.from(Crypto.getRandomBytes(16), b => b.toString(16).padStart(2, '0')).join(''),
      key: await generateBackupRecoveryKey() }));
    const cipher = await createExpoAesGcmCipher(localKey.key);
    // Drop this JS reference; JavaScript/native garbage collection is not a
    // cryptographic zeroization guarantee. No key/record/error logging.
    localKey = { version: 1, id: '', key: '' };
    const notebook = await openPersistentNotebook(database, cipher,
      value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value));
    const handle = native;
    let disposal: Promise<void> | null = null;
    const result: PersistentNotebook = {
      ...notebook,
      close() {
        notebook.close();
        disposal ??= notebook.whenIdle().then(() => handle.closeAsync());
        // Consume native close failure without emitting private raw errors.
        void disposal.catch(() => undefined);
      },
      whenIdle: () => disposal ?? notebook.whenIdle(),
    };
    live = result;
    return result;
  } catch {
    if (native) { try { await native.closeAsync(); } catch { /* Preserve database. */ } }
    throw new Error('Notebook could not be opened');
  } finally { opening = false; }
}
