/** GST helpers for platform subscription invoices. Rates and SAC should be confirmed with your CA. */
export const GST_RATE = Number(process.env.GST_RATE ?? 18);
export const PLATFORM = () => ({
  name: process.env.PLATFORM_LEGAL_NAME ?? 'SportsIQ (legal entity name not set)',
  gstin: process.env.PLATFORM_GSTIN ?? '',
  state: process.env.PLATFORM_STATE ?? 'Maharashtra',
  address: process.env.PLATFORM_ADDRESS ?? '',
  sac: process.env.PLATFORM_SAC ?? '998315',
});

export const INDIAN_STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];

/** Intra-state supply → CGST + SGST; inter-state → IGST */
export function gstSplit(taxable: number, buyerState: string, sellerState = PLATFORM().state, rate = GST_RATE) {
  const tax = Math.round((taxable * rate) / 100);
  if (buyerState.trim().toLowerCase() === sellerState.trim().toLowerCase()) {
    const cgst = Math.floor(tax / 2);
    return { cgst, sgst: tax - cgst, igst: 0, total: taxable + tax };
  }
  return { cgst: 0, sgst: 0, igst: tax, total: taxable + tax };
}

/** Indian financial year label for a date, e.g. 2026-27 */
export function financialYear(d = new Date()) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ' ' + ones[n % 10] : ''}`);
const three = (n: number) => (n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + two(n % 100) : ''}` : two(n));
/** Amount in words, Indian system (lakh / crore) */
export function inWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const cr = Math.floor(n / 1e7); n %= 1e7;
  const lk = Math.floor(n / 1e5); n %= 1e5;
  const th = Math.floor(n / 1e3); n %= 1e3;
  if (cr) parts.push(`${inWords(cr)} Crore`);
  if (lk) parts.push(`${two(lk)} Lakh`);
  if (th) parts.push(`${two(th)} Thousand`);
  if (n) parts.push(three(n));
  return parts.join(' ');
}
