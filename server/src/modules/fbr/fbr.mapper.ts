import { DEFAULT_SALE_TYPE, SCENARIOS, canonicalProvince, normalizeUom } from './fbr.reference';

export interface FbrItem {
  hsCode: string; productDescription: string; rate: string; uoM: string; quantity: number;
  totalValues: number; valueSalesExcludingST: number; fixedNotifiedValueOrRetailPrice: number;
  salesTaxApplicable: number; salesTaxWithheldAtSource: number; extraTax: number; furtherTax: number;
  sroScheduleNo: string; fedPayable: number; discount: number; saleType: string; sroItemSerialNo: string;
}

export interface FbrPayload {
  invoiceType: 'Sale Invoice';
  invoiceDate: string; // YYYY-MM-DD
  sellerNTNCNIC: string; sellerBusinessName: string; sellerProvince: string; sellerAddress: string;
  buyerNTNCNIC?: string; buyerBusinessName: string; buyerProvince: string; buyerAddress: string;
  buyerRegistrationType: 'Registered' | 'Unregistered';
  invoiceRefNo: string; // only used for debit notes
  scenarioId?: string; // sandbox only
  items: FbrItem[];
}

interface InvoiceInput {
  issueDate: Date;
  saleType?: string | null;
  buyer: { name: string; ntn?: string | null; registrationType: string; address?: string | null; province?: string | null };
  lines: { hsCode?: string | null; description: string; uom: string; quantity: number; unitPrice: number; taxRatePercent: number; net: number; tax: number; gross: number }[];
}
interface SellerInput {
  legalName: string; ntn: string;
  address?: { line1?: string | null; city?: string | null; province?: string | null } | null;
}

const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '');
const money = (minor: number) => Math.round(minor) / 100; // minor units -> rupees

export function buildFbrPayload(
  inv: InvoiceInput,
  seller: SellerInput,
  opts: { environment: 'sandbox' | 'production'; scenarioId?: string },
): FbrPayload {
  // In sandbox the sale type comes from the chosen test scenario so the two always agree
  const scenario = opts.environment === 'sandbox' ? SCENARIOS.find((s) => s.id === opts.scenarioId) : undefined;
  const saleType = scenario?.saleType ?? inv.saleType ?? DEFAULT_SALE_TYPE;
  const registered = inv.buyer.registrationType === 'registered';
  const join = (...p: (string | null | undefined)[]) => p.filter(Boolean).join(', ');

  return {
    invoiceType: 'Sale Invoice',
    invoiceDate: inv.issueDate.toISOString().slice(0, 10),
    sellerNTNCNIC: digits(seller.ntn),
    sellerBusinessName: seller.legalName,
    sellerProvince: canonicalProvince(seller.address?.province),
    sellerAddress: join(seller.address?.line1, seller.address?.city),
    ...(digits(inv.buyer.ntn) && { buyerNTNCNIC: digits(inv.buyer.ntn) }),
    buyerBusinessName: inv.buyer.name,
    buyerProvince: canonicalProvince(inv.buyer.province),
    buyerAddress: inv.buyer.address ?? '',
    buyerRegistrationType: registered ? 'Registered' : 'Unregistered',
    invoiceRefNo: '',
    ...(scenario && { scenarioId: scenario.id }),
    items: inv.lines.map((l) => ({
      hsCode: l.hsCode ?? '',
      productDescription: l.description,
      rate: `${l.taxRatePercent}%`, // must match FBR's rate description for the sale type; see "Known gaps"
      uoM: normalizeUom(l.uom),
      quantity: l.quantity,
      totalValues: 0, // the spec's samples send 0 here; the sandbox will confirm
      valueSalesExcludingST: money(l.net),
      fixedNotifiedValueOrRetailPrice: 0,
      salesTaxApplicable: money(l.tax),
      salesTaxWithheldAtSource: 0,
      extraTax: 0,
      furtherTax: 0, // not modelled yet; see "Known gaps"
      sroScheduleNo: '',
      fedPayable: 0,
      discount: 0,
      saleType,
      sroItemSerialNo: '',
    })),
  };
}