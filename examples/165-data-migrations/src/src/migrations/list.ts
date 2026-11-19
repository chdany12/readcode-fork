import { PoolClient } from "pg";
import { Migration } from "./runner";

export const migrations: Migration[] = [
  {
    id: "20261002_01_add_pipeline_runs_triggered_by",
    up: async (c: PoolClient) => {
      await c.query("ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS triggered_by text");
    },
  },
  {
    id: "20261002_02_index_pipeline_runs_triggered_by",
    transactional: false,
    up: async (c: PoolClient) => {
      await c.query(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS pipeline_runs_triggered_by_idx ON pipeline_runs (triggered_by)",
      );
    },
  },
  {
    id: "20261002_03_backfill_triggered_by",
    transactional: false,
    up: async (c: PoolClient) => {
      for (;;) {
        const { rowCount } = await c.query(
          `UPDATE pipeline_runs SET triggered_by = COALESCE(actor_login, 'system')
             WHERE id IN (
               SELECT id FROM pipeline_runs
                WHERE triggered_by IS NULL
                ORDER BY id
                LIMIT 5000
             )`,
        );
        if (!rowCount) break;
      }
    },
  },
];
