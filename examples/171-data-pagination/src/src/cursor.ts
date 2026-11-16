export interface UserCursor {
  createdAt: string;
  id: string;
}

export class InvalidCursorError extends Error {
  constructor() {
    super("invalid cursor");
    this.name = "InvalidCursorError";
  }
}

export function encodeCursor(c: UserCursor): string {
  return Buffer.from(JSON.stringify([c.createdAt, c.id]), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): UserCursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 2 ||
      typeof parsed[0] !== "string" ||
      typeof parsed[1] !== "string" ||
      Number.isNaN(Date.parse(parsed[0]))
    ) {
      throw new InvalidCursorError();
    }
    return { createdAt: parsed[0], id: parsed[1] };
  } catch {
    throw new InvalidCursorError();
  }
}
