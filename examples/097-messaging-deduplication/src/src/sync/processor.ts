import { ChangeDeduplicator, FileChangeEvent } from "./dedup";
import { SyncIndex } from "./syncIndex";
import { DeviceNotifier } from "./notifier";
import { Logger } from "./logger";

export class SyncEventProcessor {
  private readonly dedup = new ChangeDeduplicator(10 * 60 * 1000, 200_000);

  constructor(
    private readonly index: SyncIndex,
    private readonly notifier: DeviceNotifier,
    private readonly log: Logger
  ) {}

  async process(event: FileChangeEvent): Promise<void> {
    if (this.dedup.isDuplicate(event)) {
      this.log.debug({ eventId: event.eventId, fileId: event.fileId }, "dropping duplicate change");
      return;
    }

    const applied = await this.index.applyIfNewer(event);
    if (!applied) {
      this.log.info(
        { fileId: event.fileId, version: event.version },
        "stale change ignored"
      );
      this.dedup.remember(event);
      return;
    }

    await this.notifier.fanOut(event.workspaceId, {
      fileId: event.fileId,
      version: event.version,
      kind: event.kind,
      originDevice: event.deviceId,
    });
    this.dedup.remember(event);
  }
}
