import { BadRequestException } from '@nestjs/common';

/** Input rows must already be ordered by eligible_at, created_at and ledger ID (FIFO). */
export function allocateCommissionFIFO(rows: { id: string; paise: number }[], amountPaise: number) {
  const outstanding = rows.reduce((sum, row) => sum + row.paise, 0);
  if (
    !Number.isSafeInteger(amountPaise) ||
    amountPaise <= 0 ||
    amountPaise > 2147483647 ||
    rows.some((row) => !Number.isSafeInteger(row.paise) || row.paise <= 0) ||
    !Number.isSafeInteger(outstanding) ||
    amountPaise > outstanding
  )
    throw new BadRequestException(
      'Enter a positive INR amount within the outstanding commission balance.',
    );
  let remaining = amountPaise;
  const allocations: { id: string; paise: number; dueBeforePaise: number }[] = [];
  for (const row of rows) {
    if (!remaining) break;
    const paise = Math.min(remaining, row.paise);
    allocations.push({ id: row.id, paise, dueBeforePaise: row.paise });
    remaining -= paise;
  }
  return {
    outstanding,
    allocations,
    paymentType: amountPaise === outstanding ? ('FULL' as const) : ('PARTIAL' as const),
  };
}
