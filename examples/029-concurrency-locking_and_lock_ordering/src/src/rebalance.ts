import { ShardedIndex } from "./shardedIndex";

export interface Relocation {
  docId: string;
  from: string;
  to: string;
}

export async function applyRelocations(
  index: ShardedIndex,
  plan: Relocation[],
  concurrency = 8,
): Promise<{ moved: number; skipped: number }> {
  let moved = 0;
  let skipped = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < plan.length) {
      const r = plan[cursor++];
      const ok = await index.moveDocument(r.docId, r.from, r.to);
      if (ok) moved++;
      else skipped++;
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  return { moved, skipped };
}
