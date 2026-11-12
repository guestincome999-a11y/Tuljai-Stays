import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Explicit date override > configured inclusive festival window > base price. */
export async function calculateStayPrice(
  db: Pick<Prisma.TransactionClient, 'roomPricing' | 'systemSetting'>,
  roomTypeId: string,
  basePrice: Prisma.Decimal,
  checkInDate: Date,
  checkOutDate: Date,
  festivalPrice: Prisma.Decimal | null = null,
): Promise<Prisma.Decimal> {
  const nights = (checkOutDate.getTime() - checkInDate.getTime()) / 86_400_000;
  if (!Number.isInteger(nights) || nights < 1) {
    throw new BadRequestException('Check-out date must be after check-in date');
  }
  const overrides = await db.roomPricing.findMany({
    where: { roomTypeId, date: { gte: checkInDate, lt: checkOutDate } },
    select: { date: true, price: true },
  });
  const prices = new Map(overrides.map((row) => [row.date.getTime(), row.price]));
  let festivalStart: number | null = null;
  let festivalEnd: number | null = null;
  if (festivalPrice !== null) {
    const settings = await db.systemSetting.findMany({
      where: { key: { in: ['festival_start_date', 'festival_end_date'] } },
      select: { key: true, value: true },
    });
    const values = new Map(settings.map((row) => [row.key, row.value]));
    const start = values.get('festival_start_date');
    const end = values.get('festival_end_date');
    // Both empty means no festival window is configured. A partial or invalid
    // window fails visibly instead of silently charging the ordinary rate.
    if (
      (start !== undefined && start !== null && start !== '') ||
      (end !== undefined && end !== null && end !== '')
    ) {
      const validDate = (value: Prisma.JsonValue | undefined): value is string => {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const parsed = new Date(`${value}T00:00:00.000Z`);
        return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
      };
      if (!validDate(start) || !validDate(end) || start > end) {
        throw new BadRequestException(
          'Festival pricing dates are invalid. Please contact support.',
        );
      }
      festivalStart = new Date(`${start}T00:00:00.000Z`).getTime();
      festivalEnd = new Date(`${end}T00:00:00.000Z`).getTime();
    }
  }
  const festivalNights =
    festivalPrice !== null && festivalStart !== null && festivalEnd !== null
      ? Math.max(
          0,
          (Math.min(checkOutDate.getTime(), festivalEnd + 86_400_000) -
            Math.max(checkInDate.getTime(), festivalStart)) /
            86_400_000,
        )
      : 0;
  let total = basePrice
    .times(nights - festivalNights)
    .plus((festivalPrice ?? new Prisma.Decimal(0)).times(festivalNights));
  let ordinaryOverrides = 0;
  let festivalOverrides = 0;
  for (const [date, price] of prices) {
    const isFestival =
      festivalPrice !== null &&
      festivalStart !== null &&
      festivalEnd !== null &&
      date >= festivalStart &&
      date <= festivalEnd;
    if (price.isNegative()) throw new BadRequestException('Invalid room price');
    total = total.plus(price.minus(isFestival ? festivalPrice : basePrice));
    if (isFestival) festivalOverrides += 1;
    else ordinaryOverrides += 1;
  }
  if (
    (basePrice.isNegative() && nights - festivalNights > ordinaryOverrides) ||
    (festivalPrice?.isNegative() && festivalNights > festivalOverrides) ||
    total.isNegative()
  ) {
    throw new BadRequestException('Invalid room price');
  }
  return total;
}
