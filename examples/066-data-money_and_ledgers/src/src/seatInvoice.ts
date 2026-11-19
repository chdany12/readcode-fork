import { formatMinor, majorToMinor } from "./currency";

export interface SeatPlan {
  planId: string;
  currency: string;
  pricePerSeatMajor: string;
  taxRateBps: number;
}

export interface TenantSeats {
  tenantId: string;
  activeSeats: number;
  ssoEnabled: boolean;
}

export interface InvoiceLine {
  description: string;
  amountMinor: number;
}

export interface SeatInvoice {
  tenantId: string;
  currency: string;
  lines: InvoiceLine[];
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  display: string;
}

const SSO_ADDON_PER_SEAT_USD_CENTS = 150;

export function convertAddon(usdCents: number, fxRateToTarget: number): number {
  return Math.round((usdCents / 100) * fxRateToTarget * 100);
}

export function buildSeatInvoice(
  tenant: TenantSeats,
  plan: SeatPlan,
  fxRateFromUsd: number,
): SeatInvoice {
  if (!Number.isInteger(tenant.activeSeats) || tenant.activeSeats < 0) {
    throw new Error(`invalid seat count for ${tenant.tenantId}`);
  }
  const perSeat = majorToMinor(plan.pricePerSeatMajor, plan.currency);
  const lines: InvoiceLine[] = [
    {
      description: `${tenant.activeSeats} identity seats @ ${formatMinor(perSeat, plan.currency)}`,
      amountMinor: perSeat * tenant.activeSeats,
    },
  ];

  if (tenant.ssoEnabled) {
    const addonPerSeat = convertAddon(SSO_ADDON_PER_SEAT_USD_CENTS, fxRateFromUsd);
    lines.push({
      description: `SSO add-on x ${tenant.activeSeats}`,
      amountMinor: addonPerSeat * tenant.activeSeats,
    });
  }

  const subtotalMinor = lines.reduce((s, l) => s + l.amountMinor, 0);
  const taxMinor = Math.round((subtotalMinor * plan.taxRateBps) / 10_000);
  const totalMinor = subtotalMinor + taxMinor;

  return {
    tenantId: tenant.tenantId,
    currency: plan.currency,
    lines,
    subtotalMinor,
    taxMinor,
    totalMinor,
    display: formatMinor(totalMinor, plan.currency),
  };
}
