import { SessionResolver, SearchPrincipal } from "./sessionResolver";

export interface SearchBackend {
  query(index: string, text: string, tenantId: string, limit: number): Promise<unknown[]>;
}

export class Unauthorized extends Error {}
export class Forbidden extends Error {}

function readSessionCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "sid") return rest.join("=") || null;
  }
  return null;
}

export class SearchController {
  constructor(
    private readonly sessions: SessionResolver,
    private readonly backend: SearchBackend,
  ) {}

  async search(cookieHeader: string | undefined, index: string, text: string, limit = 20) {
    const principal = await this.authenticate(cookieHeader);
    if (!principal.indexes.includes(index)) {
      throw new Forbidden(`no access to index ${index}`);
    }
    const capped = Math.min(Math.max(limit, 1), 100);
    return this.backend.query(index, text, principal.tenantId, capped);
  }

  async logout(cookieHeader: string | undefined): Promise<void> {
    const sid = readSessionCookie(cookieHeader);
    if (sid) await this.sessions.revoke(sid);
  }

  private async authenticate(cookieHeader: string | undefined): Promise<SearchPrincipal> {
    const sid = readSessionCookie(cookieHeader);
    if (!sid) throw new Unauthorized("missing session");
    const principal = await this.sessions.resolve(sid);
    if (!principal) throw new Unauthorized("invalid session");
    return principal;
  }
}
