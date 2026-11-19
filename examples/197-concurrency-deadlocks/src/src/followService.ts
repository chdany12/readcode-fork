import { KeyedMutex } from "./asyncMutex";

export interface UserCounters {
  followers: number;
  following: number;
}

export interface GraphStore {
  isFollowing(followerId: string, followeeId: string): Promise<boolean>;
  insertEdge(followerId: string, followeeId: string): Promise<void>;
  deleteEdge(followerId: string, followeeId: string): Promise<void>;
  getCounters(userId: string): Promise<UserCounters>;
  putCounters(userId: string, counters: UserCounters): Promise<void>;
}

export class FollowService {
  private readonly userLocks = new KeyedMutex();

  constructor(private readonly store: GraphStore) {}

  private async withUsers<T>(followerId: string, followeeId: string, fn: () => Promise<T>): Promise<T> {
    const releaseFollower = await this.userLocks.forKey(followerId).acquire();
    const releaseFollowee = await this.userLocks.forKey(followeeId).acquire();
    try {
      return await fn();
    } finally {
      releaseFollowee();
      releaseFollower();
    }
  }

  async follow(followerId: string, followeeId: string): Promise<boolean> {
    if (followerId === followeeId) throw new Error("users cannot follow themselves");

    return this.withUsers(followerId, followeeId, async () => {
      if (await this.store.isFollowing(followerId, followeeId)) return false;

      const [a, b] = await Promise.all([
        this.store.getCounters(followerId),
        this.store.getCounters(followeeId),
      ]);
      await this.store.insertEdge(followerId, followeeId);
      await Promise.all([
        this.store.putCounters(followerId, { ...a, following: a.following + 1 }),
        this.store.putCounters(followeeId, { ...b, followers: b.followers + 1 }),
      ]);
      return true;
    });
  }

  async unfollow(followerId: string, followeeId: string): Promise<boolean> {
    if (followerId === followeeId) return false;

    return this.withUsers(followerId, followeeId, async () => {
      if (!(await this.store.isFollowing(followerId, followeeId))) return false;

      const [a, b] = await Promise.all([
        this.store.getCounters(followerId),
        this.store.getCounters(followeeId),
      ]);
      await this.store.deleteEdge(followerId, followeeId);
      await Promise.all([
        this.store.putCounters(followerId, { ...a, following: Math.max(0, a.following - 1) }),
        this.store.putCounters(followeeId, { ...b, followers: Math.max(0, b.followers - 1) }),
      ]);
      return true;
    });
  }
}
