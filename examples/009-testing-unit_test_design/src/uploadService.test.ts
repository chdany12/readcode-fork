import { QuotaExceededError, QuotaStore, BlobStore, UploadService } from "./uploadService";

class InMemoryQuotas implements QuotaStore {
  usage = new Map<string, number>();
  constructor(private readonly limit: number, private readonly failAdd = false) {}
  async usedBytes(id: string) { return this.usage.get(id) ?? 0; }
  async limitBytes() { return this.limit; }
  async addUsage(id: string, delta: number) {
    if (this.failAdd) throw new Error("quota db unavailable");
    this.usage.set(id, (this.usage.get(id) ?? 0) + delta);
  }
}

class InMemoryBlobs implements BlobStore {
  objects = new Map<string, Uint8Array>();
  async put(key: string, data: Uint8Array) {
    this.objects.set(key, data);
    return { etag: `etag-${data.byteLength}` };
  }
  async delete(key: string) { this.objects.delete(key); }
}

const bytes = (n: number) => new Uint8Array(n).fill(7);

describe("UploadService", () => {
  let quotas: InMemoryQuotas;
  let blobs: InMemoryBlobs;
  let service: UploadService;

  beforeEach(() => {
    quotas = new InMemoryQuotas(1000);
    blobs = new InMemoryBlobs();
    service = new UploadService(quotas, blobs);
  });

  it("stores the blob under the account prefix and records usage", async () => {
    const result = await service.upload("acct-1", "/docs/a.txt", bytes(300));

    expect(result).toEqual({ key: "acct-1/docs/a.txt", etag: "etag-300", size: 300 });
    expect(blobs.objects.has("acct-1/docs/a.txt")).toBe(true);
    expect(quotas.usage.get("acct-1")).toBe(300);
  });

  it("accepts an upload that exactly fills the quota", async () => {
    quotas.usage.set("acct-1", 600);

    await service.upload("acct-1", "b.bin", bytes(400));

    expect(quotas.usage.get("acct-1")).toBe(1000);
  });

  it("rejects an upload larger than the remaining quota without storing it", () => {
    quotas.usage.set("acct-1", 900);

    expect(service.upload("acct-1", "big.bin", bytes(101))).rejects.toThrow(QuotaExceededError);
    expect(blobs.objects.size).toBe(0);
  });

  it("removes the stored blob when recording usage fails", async () => {
    quotas = new InMemoryQuotas(1000, true);
    service = new UploadService(quotas, blobs);

    await expect(service.upload("acct-1", "c.txt", bytes(10))).rejects.toThrow("quota db unavailable");
    expect(blobs.objects.size).toBe(0);
  });

  it("rejects empty files", async () => {
    await expect(service.upload("acct-1", "empty", bytes(0))).rejects.toThrow("empty file");
    expect(quotas.usage.get("acct-1")).toBeUndefined();
  });
});
