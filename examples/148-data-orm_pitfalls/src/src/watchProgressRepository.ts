import { Prisma, PrismaClient } from "@prisma/client";

export interface ContinueWatchingItem {
  titleId: string;
  titleName: string;
  episodeLabel: string | null;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: Date;
}

export class WatchProgressRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordProgress(
    profileId: string,
    assetId: string,
    positionSeconds: number,
    reportedAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.watchProgress.updateMany({
      where: { profileId, assetId, updatedAt: { lt: reportedAt } },
      data: { positionSeconds, updatedAt: reportedAt },
    });
    if (result.count > 0) return true;

    try {
      await this.prisma.watchProgress.create({
        data: { profileId, assetId, positionSeconds, updatedAt: reportedAt },
      });
      return true;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return false;
      }
      throw err;
    }
  }

  async continueWatching(profileId: string, limit: number): Promise<ContinueWatchingItem[]> {
    const rows = await this.prisma.watchProgress.findMany({
      where: { profileId, completed: false },
      orderBy: [{ updatedAt: "desc" }, { assetId: "asc" }],
      take: Math.min(limit, 50),
      select: {
        positionSeconds: true,
        updatedAt: true,
        asset: {
          select: {
            durationSeconds: true,
            episodeLabel: true,
            title: { select: { id: true, name: true } },
          },
        },
      },
    });

    return rows.map((r) => ({
      titleId: r.asset.title.id,
      titleName: r.asset.title.name,
      episodeLabel: r.asset.episodeLabel,
      positionSeconds: r.positionSeconds,
      durationSeconds: r.asset.durationSeconds,
      updatedAt: r.updatedAt,
    }));
  }

  async markCompletedForTitle(profileId: string, titleId: string): Promise<number> {
    const { count } = await this.prisma.watchProgress.updateMany({
      where: { profileId, asset: { titleId } },
      data: { completed: true },
    });
    return count;
  }
}
