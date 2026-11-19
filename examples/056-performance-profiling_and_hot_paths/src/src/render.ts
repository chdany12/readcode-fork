import { Invoice, LineItem, RenderedLine, RenderedInvoice } from "./types";

const formatterCache = new Map<string, Intl.NumberFormat>();

function formatterFor(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}|${currency}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;
  return new Intl.NumberFormat(locale, { style: "currency", currency });
}

function minorUnits(currency: string): number {
  return currency === "JPY" || currency === "KRW" ? 0 : 2;
}

export function toMajor(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** minorUnits(currency);
}

function renderLine(item: LineItem, locale: string, currency: string): RenderedLine {
  const fmt = formatterFor(locale, currency);
  const lineTotal = item.unitAmountMinor * item.quantity;
  return {
    description: item.description,
    quantity: item.quantity,
    unitPrice: fmt.format(toMajor(item.unitAmountMinor, currency)),
    total: fmt.format(toMajor(lineTotal, currency)),
    totalMinor: lineTotal,
  };
}

export function renderInvoice(inv: Invoice): RenderedInvoice {
  const lines = inv.items.map((i) => renderLine(i, inv.locale, inv.currency));
  const subtotalMinor = lines.reduce((s, l) => s + l.totalMinor, 0);
  const taxMinor = Math.round((subtotalMinor * inv.taxRateBps) / 10_000);
  const fmt = formatterFor(inv.locale, inv.currency);
  return {
    invoiceId: inv.id,
    lines,
    subtotal: fmt.format(toMajor(subtotalMinor, inv.currency)),
    tax: fmt.format(toMajor(taxMinor, inv.currency)),
    total: fmt.format(toMajor(subtotalMinor + taxMinor, inv.currency)),
    totalMinor: subtotalMinor + taxMinor,
  };
}
