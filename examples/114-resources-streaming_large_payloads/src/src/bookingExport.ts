import { Router, Request, Response } from "express";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { Pool } from "pg";
import Cursor from "pg-cursor";
import { toCsvRow, CSV_HEADER, BookingRow } from "./csv";

const BATCH_SIZE = 500;

export function bookingExportRouter(pool: Pool): Router {
  const router = Router();

  router.get("/agencies/:agencyId/bookings/export.csv", async (req: Request, res: Response) => {
    const agencyId = req.params.agencyId;
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      res.status(400).json({ error: "from and to must be YYYY-MM-DD" });
      return;
    }

    const client = await pool.connect();
    const cursor = client.query(
      new Cursor<BookingRow>(
        `SELECT booking_ref, traveller_name, departs_at, origin, destination, fare_cents, currency
           FROM bookings
          WHERE agency_id = $1 AND departs_at >= $2 AND departs_at < $3
          ORDER BY departs_at, booking_ref`,
        [agencyId, from, to],
      ),
    );

    async function* rows(): AsyncGenerator<string> {
      yield CSV_HEADER;
      while (true) {
        const batch = await cursor.read(BATCH_SIZE);
        if (batch.length === 0) return;
        for (const row of batch) yield toCsvRow(row);
      }
    }

    res.status(200);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="bookings-${from}-${to}.csv"`);

    try {
      await pipeline(Readable.from(rows()), res);
    } catch (err) {
      req.log?.warn({ err, agencyId }, "booking export aborted");
      if (!res.headersSent) res.status(500).end();
    } finally {
      await cursor.close().catch(() => undefined);
      client.release();
    }
  });

  return router;
}
