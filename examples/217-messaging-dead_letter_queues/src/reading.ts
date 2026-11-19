export class InvalidReadingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReadingError";
  }
}

export interface Reading {
  deviceId: string;
  metric: string;
  value: number;
  recordedAt: Date;
}

export function parseReading(content: Buffer): Reading {
  let body: any;
  try {
    body = JSON.parse(content.toString("utf8"));
  } catch {
    throw new InvalidReadingError("payload is not valid JSON");
  }
  if (typeof body?.deviceId !== "string" || body.deviceId.length === 0) {
    throw new InvalidReadingError("missing deviceId");
  }
  if (typeof body.metric !== "string") {
    throw new InvalidReadingError("missing metric");
  }
  if (typeof body.value !== "number" || !Number.isFinite(body.value)) {
    throw new InvalidReadingError(`non-numeric value for ${body.metric}`);
  }
  const recordedAt = new Date(body.recordedAt);
  if (Number.isNaN(recordedAt.getTime())) {
    throw new InvalidReadingError("invalid recordedAt");
  }
  return { deviceId: body.deviceId, metric: body.metric, value: body.value, recordedAt };
}
