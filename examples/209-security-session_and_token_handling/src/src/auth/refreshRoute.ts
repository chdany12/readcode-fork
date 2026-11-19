import { SyncClientTokens, InvalidRefreshError } from "./syncClientTokens";

interface Req {
  body: { refreshToken?: string; deviceId?: string };
}
interface Res {
  status(code: number): Res;
  json(body: unknown): void;
}

export function refreshHandler(tokens: SyncClientTokens) {
  return async (req: Req, res: Res) => {
    const { refreshToken, deviceId } = req.body;
    if (typeof refreshToken !== "string" || typeof deviceId !== "string") {
      res.status(400).json({ error: "refreshToken and deviceId required" });
      return;
    }
    try {
      const pair = await tokens.refresh(refreshToken, deviceId);
      res.status(200).json(pair);
    } catch (err) {
      if (err instanceof InvalidRefreshError) {
        res.status(401).json({ error: "invalid_grant" });
        return;
      }
      throw err;
    }
  };
}
