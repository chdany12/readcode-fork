import { NotifierConfig, loadNotifierConfig } from "./config";

export class ConfigHolder {
  private current: NotifierConfig;

  private constructor(initial: NotifierConfig, private readonly path: string) {
    this.current = initial;
  }

  static async create(path: string): Promise<ConfigHolder> {
    return new ConfigHolder(await loadNotifierConfig(path), path);
  }

  get(): NotifierConfig {
    return this.current;
  }

  async reload(): Promise<{ ok: boolean; error?: string }> {
    try {
      this.current = await loadNotifierConfig(this.path);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
