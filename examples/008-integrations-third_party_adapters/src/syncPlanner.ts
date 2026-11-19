import { RemoteEntry, StorageProvider } from "./types";

export interface LocalIndex {
  get(path: string): Promise<{ checksum: string; modifiedAt: Date } | null>;
  getCursor(): Promise<string | null>;
  saveCursor(cursor: string): Promise<void>;
}

export type SyncAction =
  | { kind: "download"; entry: RemoteEntry }
  | { kind: "delete"; path: string }
  | { kind: "conflict"; entry: RemoteEntry };

export async function planSync(
  provider: StorageProvider,
  index: LocalIndex,
  localEditsSince: (path: string, since: Date) => Promise<boolean>,
): Promise<SyncAction[]> {
  const actions: SyncAction[] = [];
  let cursor = await index.getCursor();

  do {
    const page = await provider.listChanges(cursor);
    for (const entry of page.entries) {
      const local = await index.get(entry.path);
      if (entry.deleted) {
        if (local) actions.push({ kind: "delete", path: entry.path });
        continue;
      }
      if (local && local.checksum === entry.checksum) continue;
      if (local && (await localEditsSince(entry.path, local.modifiedAt))) {
        actions.push({ kind: "conflict", entry });
        continue;
      }
      if (!local || entry.modifiedAt > local.modifiedAt) {
        actions.push({ kind: "download", entry });
      }
    }
    cursor = page.nextCursor;
    if (cursor) await index.saveCursor(cursor);
  } while (cursor);

  return actions;
}
