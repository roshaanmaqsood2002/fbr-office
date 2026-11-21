export const formatMoney = (minor: number) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(minor / 100);

// "1,250.50" -> 125050 (null if invalid)
export function toMinor(input: string): number | null {
  const s = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [i, d = ''] = s.split('.');
  return Number(i) * 100 + Number(d.padEnd(2, '0'));
}

export const fromMinor = (m: number) => (m / 100).toFixed(2);

// Mirrors the server's calcLine so totals can be previewed live; the server is the source of truth
export function calcLine(quantity: number, unitPriceMinor: number, taxRatePercent: number) {
  const net = Math.round((Math.round(quantity * 1000) * unitPriceMinor) / 1000);
  const tax = Math.round((net * Math.round(taxRatePercent * 100)) / 10000);
  return { net, tax, gross: net + tax };
}