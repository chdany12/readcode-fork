import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = 1 + IV_LENGTH + TAG_LENGTH;

export interface KeyRing {
  activeVersion: number;
  keys: Map<number, Buffer>;
}

export class SaveDecryptError extends Error {
  constructor(message: string, readonly playerId: string) {
    super(message);
    this.name = "SaveDecryptError";
  }
}

function aadFor(playerId: string, slot: number): Buffer {
  return Buffer.from(`save:v1:${playerId}:${slot}`, "utf8");
}

export function sealSave(ring: KeyRing, playerId: string, slot: number, plaintext: Buffer): Buffer {
  const key = ring.keys.get(ring.activeVersion);
  if (!key || key.length !== 32) {
    throw new Error(`active key version ${ring.activeVersion} missing or wrong size`);
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(aadFor(playerId, slot));
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([ring.activeVersion]), iv, tag, body]);
}

export function openSave(ring: KeyRing, playerId: string, slot: number, blob: Buffer): Buffer {
  if (blob.length < HEADER_LENGTH) {
    throw new SaveDecryptError("save blob truncated", playerId);
  }
  const version = blob.readUInt8(0);
  const key = ring.keys.get(version);
  if (!key) {
    throw new SaveDecryptError(`unknown key version ${version}`, playerId);
  }
  const iv = blob.subarray(1, 1 + IV_LENGTH);
  const tag = blob.subarray(1 + IV_LENGTH, HEADER_LENGTH);
  const body = blob.subarray(HEADER_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAAD(aadFor(playerId, slot));
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    throw new SaveDecryptError("save failed authentication", playerId);
  }
}

export function needsRewrap(ring: KeyRing, blob: Buffer): boolean {
  return blob.length > 0 && blob.readUInt8(0) !== ring.activeVersion;
}
