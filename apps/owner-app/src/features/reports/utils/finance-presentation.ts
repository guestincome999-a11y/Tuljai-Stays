/** A positive receipt is distinct from gross revenue or commission owed. */
export function receivedAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  const formatted = Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount > 0 ? '+' : amount < 0 ? '−' : ''}₹${formatted}`;
}

export function financeLoadError(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  if (/date range|YYYY-MM-DD|start date/i.test(message))
    return 'Choose a valid date range, with the start date on or before the end date.';
  if (/forbidden|not assigned|only assigned|403/i.test(message))
    return 'You do not have access to this lodge’s financial records. Contact Tuljai Stays support.';
  return 'Settlement information is temporarily unavailable. Check your connection and try again.';
}

export function showEmptyFinance(state: {
  loading: boolean;
  hasData: boolean;
  hasError: boolean;
}): boolean {
  return state.hasData && !state.loading && !state.hasError;
}
