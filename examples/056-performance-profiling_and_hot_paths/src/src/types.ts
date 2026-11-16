export interface LineItem {
  description: string;
  quantity: number;
  unitAmountMinor: number;
}

export interface Invoice {
  id: string;
  locale: string;
  currency: string;
  taxRateBps: number;
  items: LineItem[];
}

export interface RenderedLine {
  description: string;
  quantity: number;
  unitPrice: string;
  total: string;
  totalMinor: number;
}

export interface RenderedInvoice {
  invoiceId: string;
  lines: RenderedLine[];
  subtotal: string;
  tax: string;
  total: string;
  totalMinor: number;
}
