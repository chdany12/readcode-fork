import { BenefitsClient, BenefitsDeduction } from "./benefitsClient";
import { TaxEstimator } from "./taxEstimator";
import { TtlCache } from "./ttlCache";

export interface PayPreview {
  employeeId: string;
  periodId: string;
  grossCents: number;
  taxCents: number;
  deductions: BenefitsDeduction[];
  netCents: number | null;
  degraded: string[];
}

const PREVIEW_TTL_MS = 15 * 60 * 1000;
const BENEFITS_TIMEOUT_MS = 800;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export class PayPreviewService {
  constructor(
    private readonly benefits: BenefitsClient,
    private readonly tax: TaxEstimator,
    private readonly cache: TtlCache<PayPreview>,
    private readonly log: { warn(msg: string, meta?: object): void },
  ) {}

  async getPreview(employeeId: string, periodId: string, grossCents: number): Promise<PayPreview> {
    const key = `preview:${employeeId}:${periodId}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const degraded: string[] = [];

    let deductions: BenefitsDeduction[] = [];
    try {
      deductions = await withTimeout(
        this.benefits.listDeductions(employeeId, periodId),
        BENEFITS_TIMEOUT_MS,
        "benefits",
      );
    } catch (err) {
      this.log.warn("benefits unavailable, preview degraded", { employeeId, periodId, err: String(err) });
      degraded.push("benefits");
    }

    const preTax = deductions.filter((d) => d.preTax).reduce((s, d) => s + d.amountCents, 0);
    const postTax = deductions.filter((d) => !d.preTax).reduce((s, d) => s + d.amountCents, 0);
    const taxCents = this.tax.estimate(grossCents - preTax);

    const preview: PayPreview = {
      employeeId,
      periodId,
      grossCents,
      taxCents,
      deductions,
      netCents: degraded.length === 0 ? grossCents - preTax - taxCents - postTax : null,
      degraded,
    };

    this.cache.set(key, preview, PREVIEW_TTL_MS);
    return preview;
  }
}
