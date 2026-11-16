export interface CarrierInvoiceLine {
  trackingNumber: string;
  service: string;
  chargeCents: number;
  currency: string;
}

export class InvoiceParseError extends Error {
  constructor(message: string, public readonly lineNo: number) {
    super(`line ${lineNo}: ${message}`);
  }
}

const AMOUNT_RE = /^-?\d+(\.\d{1,2})?$/;

export function toCents(raw: string, lineNo: number): number {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!AMOUNT_RE.test(trimmed)) {
    throw new InvoiceParseError(`invalid amount "${raw}"`, lineNo);
  }
  return Math.trunc(parseFloat(trimmed) * 100);
}

export function parseInvoiceCsv(csv: string): CarrierInvoiceLine[] {
  const rows = csv.split(/\r?\n/).filter((r) => r.trim().length > 0);
  const [header, ...body] = rows;
  const cols = header.split(",").map((c) => c.trim().toLowerCase());
  const idx = (name: string) => {
    const i = cols.indexOf(name);
    if (i < 0) throw new InvoiceParseError(`missing column ${name}`, 1);
    return i;
  };
  const tIdx = idx("tracking"), sIdx = idx("service"), aIdx = idx("amount"), cIdx = idx("currency");

  return body.map((row, i) => {
    const cells = row.split(",");
    const lineNo = i + 2;
    return {
      trackingNumber: cells[tIdx]?.trim() ?? "",
      service: cells[sIdx]?.trim() ?? "",
      chargeCents: toCents(cells[aIdx] ?? "", lineNo),
      currency: (cells[cIdx] ?? "").trim().toUpperCase(),
    };
  });
}
