import { BillingFlags } from "./billingFlags";

export interface Invoice {
  id: string;
  accountId: string;
  amountCents: number;
  currency: string;
}

export interface PaymentGateway {
  charge(req: {
    amountCents: number;
    currency: string;
    accountId: string;
    idempotencyKey: string;
  }): Promise<{ chargeId: string }>;
}

export interface ChargeResult {
  invoiceId: string;
  chargeId: string;
  gateway: "primary" | "secondary";
}

export class InvoiceCharger {
  constructor(
    private readonly flags: BillingFlags,
    private readonly primary: PaymentGateway,
    private readonly secondary: PaymentGateway,
  ) {}

  async charge(invoice: Invoice): Promise<ChargeResult> {
    if (invoice.amountCents <= 0) {
      throw new Error(`invoice ${invoice.id} has non-positive amount`);
    }
    const useSecondary = this.flags.isEnabledForAccount(
      "route_to_secondary_gateway",
      invoice.accountId,
    );
    const gateway = useSecondary ? this.secondary : this.primary;
    const { chargeId } = await gateway.charge({
      amountCents: invoice.amountCents,
      currency: invoice.currency,
      accountId: invoice.accountId,
      idempotencyKey: `invoice-${invoice.id}`,
    });
    return {
      invoiceId: invoice.id,
      chargeId,
      gateway: useSecondary ? "secondary" : "primary",
    };
  }
}
