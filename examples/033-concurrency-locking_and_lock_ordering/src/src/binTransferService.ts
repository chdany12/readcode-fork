import { KeyedMutex } from "./keyedMutex";

export interface BinStock {
  binId: string;
  sku: string;
  quantity: number;
}

export interface StockRepository {
  get(binId: string, sku: string): Promise<BinStock | undefined>;
  put(stock: BinStock): Promise<void>;
}

export class InsufficientStockError extends Error {
  constructor(binId: string, sku: string, requested: number, available: number) {
    super(`bin ${binId} has ${available} of ${sku}, requested ${requested}`);
    this.name = "InsufficientStockError";
  }
}

export interface TransferRequest {
  sku: string;
  fromBin: string;
  toBin: string;
  quantity: number;
}

export class BinTransferService {
  private readonly locks = new KeyedMutex();

  constructor(private readonly repo: StockRepository) {}

  async transfer(req: TransferRequest): Promise<void> {
    if (req.quantity <= 0) {
      throw new RangeError("quantity must be positive");
    }
    if (req.fromBin === req.toBin) {
      return;
    }

    const releaseFrom = await this.locks.acquire(`${req.fromBin}:${req.sku}`);
    try {
      const releaseTo = await this.locks.acquire(`${req.toBin}:${req.sku}`);
      try {
        await this.move(req);
      } finally {
        releaseTo();
      }
    } finally {
      releaseFrom();
    }
  }

  async adjust(binId: string, sku: string, delta: number): Promise<number> {
    const release = await this.locks.acquire(`${binId}:${sku}`);
    try {
      const stock = (await this.repo.get(binId, sku)) ?? { binId, sku, quantity: 0 };
      const next = stock.quantity + delta;
      if (next < 0) {
        throw new InsufficientStockError(binId, sku, -delta, stock.quantity);
      }
      await this.repo.put({ ...stock, quantity: next });
      return next;
    } finally {
      release();
    }
  }

  private async move(req: TransferRequest): Promise<void> {
    const source = await this.repo.get(req.fromBin, req.sku);
    const available = source?.quantity ?? 0;
    if (available < req.quantity) {
      throw new InsufficientStockError(req.fromBin, req.sku, req.quantity, available);
    }
    const target = (await this.repo.get(req.toBin, req.sku)) ?? {
      binId: req.toBin,
      sku: req.sku,
      quantity: 0,
    };
    await this.repo.put({ ...source!, quantity: available - req.quantity });
    await this.repo.put({ ...target, quantity: target.quantity + req.quantity });
  }
}
