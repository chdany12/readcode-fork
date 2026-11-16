import { createCipheriv, createDecipheriv, createHash } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = 1;

export interface SealedReading {
  v: number;
  keyId: string;
  iv: string;
  tag: string;
  data: string;
}

export interface KeyRing {
  activeKeyId: string;
  keys: Map<string, Buffer>;
}

function deviceIv(deviceId: string, keyId: string): Buffer {
  return createHash("sha256").update(`${keyId}:${deviceId}`).digest().subarray(0, 12);
}

export function sealReading(ring: KeyRing, deviceId: string, payload: object): SealedReading {
  const key = ring.keys.get(ring.activeKeyId);
  if (!key || key.length !== 32) throw new Error(`active key ${ring.activeKeyId} unavailable`);
  const iv = deviceIv(deviceId, ring.activeKeyId);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(deviceId, "utf8"));
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return {
    v: FORMAT_VERSION,
    keyId: ring.activeKeyId,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

export function openReading(ring: KeyRing, deviceId: string, sealed: SealedReading): unknown {
  if (sealed.v !== FORMAT_VERSION) throw new Error(`unsupported format ${sealed.v}`);
  const key = ring.keys.get(sealed.keyId);
  if (!key) throw new Error(`unknown key ${sealed.keyId}`);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(sealed.iv, "base64"));
  decipher.setAAD(Buffer.from(deviceId, "utf8"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(sealed.data, "base64")), decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}
