import { readFile } from "node:fs/promises";

export interface SigningKeys {
  current: Buffer;
  previous: Buffer | null;
}

export class SecretLoadError extends Error {
  constructor(name: string, reason: string) {
    super(`secret ${name} unavailable: ${reason}`);
    this.name = "SecretLoadError";
  }
}

async function readSecretFile(path: string, name: string): Promise<Buffer> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    throw new SecretLoadError(name, (err as NodeJS.ErrnoException).code ?? "read failed");
  }
  const trimmed = raw.trim();
  if (trimmed.length < 32) {
    throw new SecretLoadError(name, "too short");
  }
  return Buffer.from(trimmed, "utf8");
}

export async function loadCourierSigningKeys(env: NodeJS.ProcessEnv): Promise<SigningKeys> {
  const currentPath = env.COURIER_WEBHOOK_KEY_FILE;
  if (!currentPath) {
    throw new SecretLoadError("COURIER_WEBHOOK_KEY_FILE", "not configured");
  }
  const current = await readSecretFile(currentPath, "courier_webhook_key");
  const previousPath = env.COURIER_WEBHOOK_PREVIOUS_KEY_FILE;
  const previous = previousPath ? await readSecretFile(previousPath, "courier_webhook_key_previous") : null;
  return { current, previous };
}
