// All money is integer minor units (paisa). Never use floats for amounts.

export function parseMoneyToMinor(input: string): number {
  const s = String(input).trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('Invalid amount');
  const [i, d = ''] = s.split('.');
  return Number(i) * 100 + Number(d.padEnd(2, '0'));
}

export function parseDecimal(input: string, maxDecimals: number): number {
  const s = String(input).trim().replace(/,/g, '');
  if (!new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`).test(s)) throw new Error('Invalid number');
  return Number(s);
}

// quantity: up to 3 decimals, unitPrice: minor units, taxRatePercent: up to 2 decimals
// Rounding is half-up per line. Confirm against the FBR rounding rules in Phase 0.
export function calcLine(quantity: number, unitPriceMinor: number, taxRatePercent: number) {
  const qtyMilli = Math.round(quantity * 1000);
  const net = Math.round((qtyMilli * unitPriceMinor) / 1000);
  const rateBp = Math.round(taxRatePercent * 100);
  const tax = Math.round((net * rateBp) / 10000);
  return { net, tax, gross: net + tax };
}