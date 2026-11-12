import { BadRequestException } from '@nestjs/common';

// Date-only controls represent complete calendar days in Tuljapur (IST).
export function reportDateRange(startDate?: string, endDate?: string) {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Report dates must use YYYY-MM-DD.');
    }
    const utc = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('Choose valid report dates.');
    }
    return new Date(utc.getTime() - 330 * 60_000);
  };
  const start = startDate ? parse(startDate) : undefined;
  const end = endDate ? parse(endDate) : undefined;
  if (start && end && start > end) {
    throw new BadRequestException('Start date must be on or before end date.');
  }
  return { gte: start, lt: end ? new Date(end.getTime() + 86_400_000) : undefined };
}
