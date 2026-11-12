import { BadRequestException } from '@nestjs/common';

export function operationalDateRange(checkIn?: string, checkOut?: string) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const start = checkIn ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(Date.parse(`${start}T00:00:00Z`)))
    throw new BadRequestException('Enter valid stay dates');
  const end =
    checkOut ?? new Date(Date.parse(`${start}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  for (const value of [start, end]) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('Enter valid stay dates');
  }
  if (start >= end) throw new BadRequestException('Check-out must be after check-in');
  return { checkInDate: start, checkOutDate: end };
}
