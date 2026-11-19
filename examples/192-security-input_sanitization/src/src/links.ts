export interface LinkPreview {
  href: string;
  label: string;
}

const MAX_URL_LENGTH = 2048;
const BLOCKED_SCHEMES = /^(javascript|vbscript):/i;

export function normalizeLink(raw: string): LinkPreview | null {
  if (raw.length > MAX_URL_LENGTH) {
    return null;
  }
  if (BLOCKED_SCHEMES.test(raw)) {
    return null;
  }
  const href = raw.includes(":") ? raw : `https://${raw}`;
  let label: string;
  try {
    label = new URL(href).hostname || href;
  } catch {
    label = href;
  }
  return { href, label };
}
