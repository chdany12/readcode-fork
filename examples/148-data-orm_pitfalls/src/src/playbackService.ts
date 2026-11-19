import { PrismaClient } from "@prisma/client";
import { WatchProgressRepository } from "./watchProgressRepository";

const COMPLETION_RATIO = 0.95;

export class PlaybackService {
  private readonly progress: WatchProgressRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.progress = new WatchProgressRepository(prisma);
  }

  async heartbeat(profileId: string, assetId: string, positionSeconds: number, sentAt: Date) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { durationSeconds: true, titleId: true, isFinale: true },
    });
    if (!asset) throw new Error(`unknown asset ${assetId}`);

    const clamped = Math.max(0, Math.min(positionSeconds, asset.durationSeconds));
    const applied = await this.progress.recordProgress(profileId, assetId, clamped, sentAt);

    if (applied && asset.isFinale && clamped >= asset.durationSeconds * COMPLETION_RATIO) {
      await this.progress.markCompletedForTitle(profileId, asset.titleId);
    }
    return { applied };
  }

  async removeProfile(profileId: string) {
    await this.prisma.$transaction([
      this.prisma.watchProgress.deleteMany({ where: { profileId } }),
      this.prisma.profile.delete({ where: { id: profileId } }),
    ]);
  }

  continueWatching(profileId: string, limit = 20) {
    return this.progress.continueWatching(profileId, limit);
  }
}
