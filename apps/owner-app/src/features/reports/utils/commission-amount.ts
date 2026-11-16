/** Parse the entered rupees directly into integer paise; never round an invalid amount. */
export function commissionAmountPaise(input: string): number | null {
  const value = input.trim().replace(/^\./, '0.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [rupees, fraction = ''] = value.split('.');
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(paise) && paise > 0 && paise <= 2147483647 ? paise : null;
}
