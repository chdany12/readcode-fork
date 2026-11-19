import type { Request, Response, NextFunction } from "express";
import { parseSearchParams } from "./searchParams";
import { ValidationError } from "./errors";

export interface SearchEngine {
  search(req: {
    text: string;
    size: number;
    from: number;
    sort: string;
    termFilters: Record<string, string>;
  }): Promise<{ total: number; hits: Array<{ id: string; score: number }> }>;
}

export function searchRoute(engine: SearchEngine) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let params;
    try {
      params = parseSearchParams(req.query as Record<string, string | undefined>);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ error: "invalid_parameter", field: err.field, message: err.message });
        return;
      }
      return next(err);
    }

    try {
      const result = await engine.search({
        text: params.q,
        size: params.limit,
        from: params.offset,
        sort: params.sort,
        termFilters: params.filters,
      });
      res.json({ total: result.total, limit: params.limit, offset: params.offset, hits: result.hits });
    } catch (err) {
      next(err);
    }
  };
}
