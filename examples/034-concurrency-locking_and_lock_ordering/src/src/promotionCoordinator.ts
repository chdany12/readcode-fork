import { EnvironmentLock } from "./environmentLock";

export interface Artifact {
  pipelineId: string;
  digest: string;
}

export interface DeployTarget {
  name: string;
  apply(artifact: Artifact): Promise<void>;
  healthCheck(): Promise<boolean>;
  currentDigest(): Promise<string | null>;
}

export interface DeployResult {
  environment: string;
  digest: string;
  skipped: boolean;
}

export class HealthCheckFailedError extends Error {
  constructor(env: string, digest: string) {
    super(`health check failed on ${env} for ${digest}`);
    this.name = "HealthCheckFailedError";
  }
}

export class PromotionCoordinator {
  private readonly locks = new Map<string, EnvironmentLock>();

  constructor(private readonly targets: Map<string, DeployTarget>) {}

  private lockFor(env: string): EnvironmentLock {
    let lock = this.locks.get(env);
    if (!lock) {
      lock = new EnvironmentLock();
      this.locks.set(env, lock);
    }
    return lock;
  }

  async promote(env: string, artifact: Artifact): Promise<DeployResult> {
    const target = this.targets.get(env);
    if (!target) {
      throw new Error(`unknown environment ${env}`);
    }
    const owner = `${artifact.pipelineId}@${artifact.digest}`;
    const lock = this.lockFor(env);

    await lock.acquire(owner);
    const deployed = await target.currentDigest();
    if (deployed === artifact.digest) {
      lock.release(owner);
      return { environment: env, digest: artifact.digest, skipped: true };
    }

    await target.apply(artifact);
    const healthy = await target.healthCheck();
    if (!healthy) {
      lock.release(owner);
      throw new HealthCheckFailedError(env, artifact.digest);
    }
    lock.release(owner);
    return { environment: env, digest: artifact.digest, skipped: false };
  }

  status(): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    for (const [env, lock] of this.locks) {
      out[env] = lock.currentHolder();
    }
    return out;
  }
}
