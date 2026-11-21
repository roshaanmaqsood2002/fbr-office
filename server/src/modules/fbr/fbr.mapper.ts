export interface FbrPayload {
  seller: { name: string; ntn: string; strn?: string };
  invoiceRef: string;
  invoiceDate: string; // YYYY-MM-DD
  buyer: { name: string; ntn?: string; registrationType: string; address?: string; province?: string };
  items: {
    hsCode?: string; description: string; uom: string; quantity: number; unitPrice: string;
    taxRatePercent: number; valueExclTax: string; taxAmount: string; total: string;
  }[];
  totals: { valueExclTax: string; taxAmount: string; total: string };
}

interface InvoiceInput {
  invoiceNumber?: string | null;
  issueDate: Date;
  buyer: { name: string; ntn?: string | null; registrationType: string; address?: string | null; province?: string | null };
  lines: { hsCode?: string | null; description: string; uom: string; quantity: number; unitPrice: number; taxRatePercent: number; net: number; tax: number; gross: number }[];
  totals: { net: number; tax: number; gross: number };
}

const dec = (minor: number) => (minor / 100).toFixed(2); // minor units -> "1250.50"

// TODO(spec): replace with the official FBR field names and structure
export function buildFbrPayload(inv: InvoiceInput, seller: { legalName: string; ntn: string; strn?: string | null }): FbrPayload {
  return {
    seller: { name: seller.legalName, ntn: seller.ntn, ...(seller.strn && { strn: seller.strn }) },
    invoiceRef: inv.invoiceNumber ?? '',
    invoiceDate: inv.issueDate.toISOString().slice(0, 10),
    buyer: {
      name: inv.buyer.name, registrationType: inv.buyer.registrationType,
      ...(inv.buyer.ntn && { ntn: inv.buyer.ntn }), ...(inv.buyer.address && { address: inv.buyer.address }),
      ...(inv.buyer.province && { province: inv.buyer.province }),
    },
    items: inv.lines.map((l) => ({
      ...(l.hsCode && { hsCode: l.hsCode }), description: l.description, uom: l.uom, quantity: l.quantity,
      unitPrice: dec(l.unitPrice), taxRatePercent: l.taxRatePercent,
      valueExclTax: dec(l.net), taxAmount: dec(l.tax), total: dec(l.gross),
    })),
    totals: { valueExclTax: dec(inv.totals.net), taxAmount: dec(inv.totals.tax), total: dec(inv.totals.gross) },
  };
}