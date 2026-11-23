export interface Line {
  productId?: string;
  sourceTransactionId?: string;
  description: string;
  hsCode?: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  taxRatePercent: number;
  net?: number;
  tax?: number;
  gross?: number;
}
export interface Buyer {
  customerId?: string;
  name: string;
  registrationType: "registered" | "unregistered";
  ntn?: string;
  address?: string;
  province?: string;
}
export interface Invoice {
  _id: string;
  invoiceNumber?: string;
  fbrInvoiceNumber?: string;
  fbrLastError?: string;
  status: string;
  issueDate: string;
  saleType?: string;
  dueDate?: string;
  notes?: string;
  returnReason?: string;
  buyer: Buyer;
  lines: Line[];
  totals: { net: number; tax: number; gross: number };
}
export interface Issue {
  field: string;
  message: string;
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  awaiting_approval: "Awaiting approval",
  ready_to_submit: "Ready to submit",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
  action_required: "Action required",
  cancelled: "Cancelled",
};
