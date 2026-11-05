/**
 * Deal dossier data model — PREVIEW ONLY.
 *
 * NEVER save validated dossiers into plaintext AsyncStorage, notifications,
 * logs or user-facing share sheets. Store the dossier as authenticated
 * encrypted content with its file attachments in a separate private vault.
 *
 * This is only a schema validator; no file picking, encryption, upload,
 * local persistence, or restore is implemented in this module.
 */

export const DEAL_DOSSIER_KIND = 'ai-memory-encrypted-deal-dossier';
export const DEAL_DOSSIER_VERSION = 1;
export const MAX_DEALS_PER_PERSON = 2_000;
export const MAX_ATTACHMENTS_PER_DEAL = 100;

export type DealStage = 'lead' | 'quoted' | 'negotiating' | 'won' | 'lost';

export type DealLineItem = {
  id: string;
  description: string;
  /** Decimal text for exact quantity representation; never floating point. */
  quantity: string;
  unit?: string;
  sku?: string;
};

export type EncryptedDealAttachment = {
  id: string;
  /** Original human-readable filename, private inside encrypted dossier. */
  fileName: string;
  mimeType: string;
  /** Opaque ID into a verified encrypted-blob store; NOT content:// or file://. */
  encryptedBlobId: string;
  /** SHA-256 digest of encrypted blob bytes, never plaintext. */
  ciphertextSha256: string;
  encryptedByteSize: number;
};

export type DealRecord = {
  id: string;
  title: string;
  stage: DealStage;
  /** ISO 4217 uppercase code; precision depends on currency. */
  currency: string;
  /** Monetary total in smallest currency units, as exact positive integer text. */
  amountMinor: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  description?: string;
  lineItems: DealLineItem[];
  attachments: EncryptedDealAttachment[];
};

export type PersonDealDossier = {
  kind: typeof DEAL_DOSSIER_KIND;
  version: typeof DEAL_DOSSIER_VERSION;
  personId: string;
  deals: DealRecord[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength ||
    /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error('Invalid ' + label);
  }
  return value.trim();
}

function optionalText(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  return requiredText(value, label, maxLength);
}

function isoTimestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))) {
    throw new Error('Invalid ' + label);
  }
  return value;
}

function lineItem(input: unknown): DealLineItem {
  const item = asRecord(input);
  if (!item) throw new Error('Invalid sale line item');
  const quantity = requiredText(item.quantity, 'quantity', 20);
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(quantity) ||
    !/[1-9]/.test(quantity)) {
    throw new Error('Invalid item quantity');
  }
  return {
    id: requiredText(item.id, 'item ID', 128),
    description: requiredText(item.description, 'item description', 1000),
    quantity,
    ...(item.unit === undefined ? {} : { unit: requiredText(item.unit, 'unit', 40) }),
    ...(item.sku === undefined ? {} : { sku: requiredText(item.sku, 'SKU', 128) }),
  };
}

function encryptedAttachment(input: unknown): EncryptedDealAttachment {
  const item = asRecord(input);
  if (!item) throw new Error('Invalid encrypted attachment');
  const fileName = requiredText(item.fileName, 'attachment filename', 200);
  if (/[/\\]/.test(fileName) || fileName === '.' || fileName === '..') {
    throw new Error('Unsafe attachment filename');
  }
  const encryptedBlobId = requiredText(item.encryptedBlobId, 'encrypted blob ID', 128);
  if (!/^[A-Za-z0-9_-]{12,128}$/.test(encryptedBlobId)) {
    throw new Error('Invalid encrypted blob ID');
  }
  const sha = requiredText(item.ciphertextSha256, 'encrypted blob digest', 64);
  if (!/^[a-fA-F0-9]{64}$/.test(sha)) throw new Error('Invalid encrypted blob digest');
  if (!Number.isSafeInteger(item.encryptedByteSize) || (item.encryptedByteSize as number) < 29) {
    throw new Error('Invalid encrypted attachment size');
  }
  const mimeType = requiredText(item.mimeType, 'attachment MIME type', 128);
  if (!/^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(mimeType)) {
    throw new Error('Invalid attachment MIME type');
  }
  return {
    id: requiredText(item.id, 'attachment ID', 128),
    fileName,
    mimeType,
    encryptedBlobId,
    ciphertextSha256: sha.toLowerCase(),
    encryptedByteSize: item.encryptedByteSize as number,
  };
}

function uniqueIds<T extends { id: string }>(records: T[], label: string): void {
  const ids = new Set<string>();
  for (const item of records) {
    if (ids.has(item.id)) throw new Error('Duplicate ' + label);
    ids.add(item.id);
  }
}

function deal(input: unknown): DealRecord {
  const item = asRecord(input);
  if (!item) throw new Error('Invalid deal');
  const stage = item.stage;
  if (stage !== 'lead' && stage !== 'quoted' && stage !== 'negotiating' &&
    stage !== 'won' && stage !== 'lost') throw new Error('Invalid deal stage');
  const currency = requiredText(item.currency, 'currency', 3);
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Invalid currency');
  const amountMinor = requiredText(item.amountMinor, 'deal amount', 18);
  if (!/^(?:0|[1-9]\d{0,17})$/.test(amountMinor)) throw new Error('Invalid amount in minor units');
  if (!Array.isArray(item.lineItems) || item.lineItems.length > 500) {
    throw new Error('Invalid sale items');
  }
  if (!Array.isArray(item.attachments) || item.attachments.length > MAX_ATTACHMENTS_PER_DEAL) {
    throw new Error('Invalid deal attachments');
  }
  const lines = item.lineItems.map(lineItem);
  const attachments = item.attachments.map(encryptedAttachment);
  uniqueIds(lines, 'line item ID');
  uniqueIds(attachments, 'attachment ID');
  const createdAt = isoTimestamp(item.createdAt, 'creation time');
  const updatedAt = isoTimestamp(item.updatedAt, 'update time');
  const closedAt = item.closedAt === undefined ? undefined : isoTimestamp(item.closedAt, 'close time');
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error('Deal updated before creation');
  if (closedAt && Date.parse(closedAt) < Date.parse(createdAt)) throw new Error('Deal closed before creation');

  return {
    id: requiredText(item.id, 'deal ID', 128),
    title: requiredText(item.title, 'deal title', 160),
    stage,
    currency,
    amountMinor,
    createdAt,
    updatedAt,
    ...(closedAt === undefined ? {} : { closedAt }),
    ...(item.description === undefined ? {} : {
      description: requiredText(item.description, 'deal description', 10000),
    }),
    lineItems: lines,
    attachments,
  };
}

export function validateEncryptedPersonDealDossier(input: unknown): PersonDealDossier {
  const dossier = asRecord(input);
  if (!dossier || dossier.kind !== DEAL_DOSSIER_KIND ||
    dossier.version !== DEAL_DOSSIER_VERSION) {
    throw new Error('Invalid or unsupported deal dossier version');
  }
  if (!Array.isArray(dossier.deals) || dossier.deals.length > MAX_DEALS_PER_PERSON) {
    throw new Error('Invalid or oversized deal list');
  }
  const deals = dossier.deals.map(deal);
  uniqueIds(deals, 'deal ID');

  return {
    kind: DEAL_DOSSIER_KIND,
    version: DEAL_DOSSIER_VERSION,
    personId: requiredText(dossier.personId, 'linked person ID', 128),
    deals,
  };
}
