import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminBookingConflict,
  AdminBookingDateRange,
  AdminBookingViewKey,
  AdminBookingViewPage,
  AdminBookingViewRow,
  BookingStatus,
} from '@tuljai/types';

import { PrismaService } from '../prisma/prisma.service';

export const BOOKING_VIEW_KEYS: AdminBookingViewKey[] = ['upcoming', 'active', 'completed', 'cancelled'];
export const BOOKING_DATE_RANGES: AdminBookingDateRange[] = [
  'all',
  'today',
  'tomorrow',
  'week',
  'later',
  'custom',
];

/** Statuses that hold a room for the guest (used for conflict detection). */
const HOLDING_STATUSES: BookingStatus[] = ['ACCEPTED', 'QR_GENERATED', 'CHECKED_IN'];

const VIEW_STATUSES: Record<AdminBookingViewKey, BookingStatus[]> = {
  active: ['CHECKED_IN'],
  cancelled: ['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'],
  completed: ['CHECKED_OUT', 'COMPLETED'],
  upcoming: ['PENDING_OWNER_APPROVAL', 'ACCEPTED', 'QR_GENERATED'],
};

interface ViewDbRow {
  bookingCode: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  id: string;
  lodgeName: string;
  paymentStatus: string;
  roomTypeName: string;
  status: BookingStatus;
  totalAmount: string | null;
}

interface ConflictBookingDb {
  bookingCode: string;
  bookingId: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  status: BookingStatus;
}

interface DoubleBookedDb {
  a: ConflictBookingDb;
  b: ConflictBookingDb;
  lodgeName: string;
  onDate: string;
  roomNumber: string;
}

interface OverbookedDb {
  bookings: ConflictBookingDb[];
  booked: number;
  lodgeName: string;
  onDate: string;
  roomTypeName: string;
  totalRooms: number;
}

function istDate(offsetDays: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000),
  );
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

@Injectable()
export class BookingViewsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async listView(input: {
    from?: string;
    page: number;
    pageSize: number;
    range: AdminBookingDateRange;
    search?: string;
    to?: string;
    view: AdminBookingViewKey;
  }): Promise<AdminBookingViewPage> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`b.deleted_at IS NULL`,
      Prisma.sql`b.status::text IN (${Prisma.join(VIEW_STATUSES[input.view])})`,
    ];
    if (input.view === 'upcoming') {
      const today = istDate(0);
      conditions.push(Prisma.sql`b.check_in_date >= ${today}::date`);
      if (input.range === 'today') conditions.push(Prisma.sql`b.check_in_date = ${today}::date`);
      else if (input.range === 'tomorrow')
        conditions.push(Prisma.sql`b.check_in_date = ${istDate(1)}::date`);
      else if (input.range === 'week')
        conditions.push(Prisma.sql`b.check_in_date <= ${istDate(6)}::date`);
      else if (input.range === 'later')
        conditions.push(Prisma.sql`b.check_in_date > ${istDate(6)}::date`);
      else if (input.range === 'custom') {
        if (input.from && DATE_PATTERN.test(input.from))
          conditions.push(Prisma.sql`b.check_in_date >= ${input.from}::date`);
        if (input.to && DATE_PATTERN.test(input.to))
          conditions.push(Prisma.sql`b.check_in_date <= ${input.to}::date`);
      }
    }
    if (input.search) {
      const like = `%${input.search}%`;
      conditions.push(
        Prisma.sql`(b.booking_code ILIKE ${like} OR b.guest_name ILIKE ${like} OR l.name ILIKE ${like})`,
      );
    }
    const where = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
    const order =
      input.view === 'upcoming'
        ? Prisma.sql`b.check_in_date ASC, b.created_at ASC`
        : input.view === 'active'
          ? Prisma.sql`b.check_out_date ASC`
          : Prisma.sql`b.updated_at DESC`;
    const offset = (input.page - 1) * input.pageSize;

    const [rows, totals] = await Promise.all([
      this.prisma.$queryRaw<ViewDbRow[]>(Prisma.sql`
        SELECT
          b.id,
          b.booking_code AS "bookingCode",
          b.guest_name AS "guestName",
          l.name AS "lodgeName",
          rt.name AS "roomTypeName",
          to_char(b.check_in_date, 'YYYY-MM-DD') AS "checkInDate",
          to_char(b.check_out_date, 'YYYY-MM-DD') AS "checkOutDate",
          b.status::text AS status,
          b.payment_status::text AS "paymentStatus",
          b.total_amount::text AS "totalAmount"
        FROM bookings b
        INNER JOIN lodges l ON l.id = b.lodge_id
        INNER JOIN room_types rt ON rt.id = b.room_type_id
        ${where}
        ORDER BY ${order}
        LIMIT ${input.pageSize} OFFSET ${offset}
      `),
      this.prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM bookings b
        INNER JOIN lodges l ON l.id = b.lodge_id
        ${where}
      `),
    ]);
    const totalItems = totals[0]?.total ?? 0;
    return {
      items: rows.map(
        (row): AdminBookingViewRow => ({
          bookingCode: row.bookingCode,
          checkInDate: row.checkInDate,
          checkOutDate: row.checkOutDate,
          guestName: row.guestName,
          id: row.id,
          lodgeName: row.lodgeName,
          paymentStatus: row.paymentStatus,
          roomTypeName: row.roomTypeName,
          status: row.status,
          totalAmount: row.totalAmount,
        }),
      ),
      page: input.page,
      pageSize: input.pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / input.pageSize)),
    };
  }

  /**
   * Conflicts that need a human: the same physical room held by two overlapping bookings, or a
   * room type with more overlapping bookings than it has rooms. Looks at current and upcoming
   * stays only (next 90 days).
   */
  public async listConflicts(): Promise<AdminBookingConflict[]> {
    const today = istDate(0);
    const horizon = istDate(90);
    const [doubleBooked, overbooked] = await Promise.all([
      this.prisma.$queryRaw<DoubleBookedDb[]>(Prisma.sql`
        SELECT
          l.name AS "lodgeName",
          r.room_number AS "roomNumber",
          to_char(GREATEST(b1.check_in_date, b2.check_in_date), 'YYYY-MM-DD') AS "onDate",
          json_build_object(
            'bookingId', b1.id, 'bookingCode', b1.booking_code, 'guestName', b1.guest_name,
            'status', b1.status::text,
            'checkInDate', to_char(b1.check_in_date, 'YYYY-MM-DD'),
            'checkOutDate', to_char(b1.check_out_date, 'YYYY-MM-DD')
          ) AS a,
          json_build_object(
            'bookingId', b2.id, 'bookingCode', b2.booking_code, 'guestName', b2.guest_name,
            'status', b2.status::text,
            'checkInDate', to_char(b2.check_in_date, 'YYYY-MM-DD'),
            'checkOutDate', to_char(b2.check_out_date, 'YYYY-MM-DD')
          ) AS b
        FROM bookings b1
        INNER JOIN bookings b2
          ON b2.room_id = b1.room_id
         AND b2.id > b1.id
         AND b2.check_in_date < b1.check_out_date
         AND b1.check_in_date < b2.check_out_date
        INNER JOIN rooms r ON r.id = b1.room_id
        INNER JOIN lodges l ON l.id = b1.lodge_id
        WHERE b1.room_id IS NOT NULL
          AND b1.deleted_at IS NULL AND b2.deleted_at IS NULL
          AND b1.status::text IN (${Prisma.join(HOLDING_STATUSES)})
          AND b2.status::text IN (${Prisma.join(HOLDING_STATUSES)})
          AND b1.check_out_date >= ${today}::date
          AND b2.check_out_date >= ${today}::date
        ORDER BY GREATEST(b1.check_in_date, b2.check_in_date) ASC
        LIMIT 100
      `),
      this.prisma.$queryRaw<OverbookedDb[]>(Prisma.sql`
        WITH days AS (
          SELECT generate_series(${today}::date, ${horizon}::date, interval '1 day')::date AS d
        ),
        counts AS (
          SELECT rt.id AS room_type_id, rt.name AS room_type_name, rt.total_rooms, l.name AS lodge_name,
                 days.d AS d, COUNT(b.id)::int AS booked
          FROM room_types rt
          INNER JOIN lodges l ON l.id = rt.lodge_id
          CROSS JOIN days
          INNER JOIN bookings b
            ON b.room_type_id = rt.id
           AND b.deleted_at IS NULL
           AND b.status::text IN (${Prisma.join(HOLDING_STATUSES)})
           AND b.check_in_date <= days.d AND b.check_out_date > days.d
          WHERE rt.deleted_at IS NULL
          GROUP BY rt.id, rt.name, rt.total_rooms, l.name, days.d
          HAVING COUNT(b.id) > rt.total_rooms
        ),
        worst AS (
          SELECT DISTINCT ON (room_type_id) room_type_id, room_type_name, total_rooms, lodge_name,
                 to_char(d, 'YYYY-MM-DD') AS on_date, booked, d
          FROM counts
          ORDER BY room_type_id, d ASC
        )
        SELECT
          w.lodge_name AS "lodgeName",
          w.room_type_name AS "roomTypeName",
          w.total_rooms AS "totalRooms",
          w.booked,
          w.on_date AS "onDate",
          (
            SELECT COALESCE(json_agg(json_build_object(
              'bookingId', b.id, 'bookingCode', b.booking_code, 'guestName', b.guest_name,
              'status', b.status::text,
              'checkInDate', to_char(b.check_in_date, 'YYYY-MM-DD'),
              'checkOutDate', to_char(b.check_out_date, 'YYYY-MM-DD')
            ) ORDER BY b.check_in_date), '[]'::json)
            FROM bookings b
            WHERE b.room_type_id = w.room_type_id
              AND b.deleted_at IS NULL
              AND b.status::text IN (${Prisma.join(HOLDING_STATUSES)})
              AND b.check_in_date <= w.d AND b.check_out_date > w.d
          ) AS bookings
        FROM worst w
        ORDER BY w.d ASC
        LIMIT 100
      `),
    ]);

    const conflicts: AdminBookingConflict[] = [
      ...doubleBooked.map(
        (row): AdminBookingConflict => ({
          bookings: [row.a, row.b],
          detail: `Room ${row.roomNumber} is held by two overlapping bookings.`,
          id: `room-${row.a.bookingId}-${row.b.bookingId}`,
          kind: 'DOUBLE_BOOKED_ROOM',
          lodgeName: row.lodgeName,
          onDate: row.onDate,
        }),
      ),
      ...overbooked.map(
        (row): AdminBookingConflict => ({
          bookings: row.bookings,
          detail: `${row.roomTypeName}: ${row.booked} bookings overlap but only ${row.totalRooms} ${row.totalRooms === 1 ? 'room exists' : 'rooms exist'}.`,
          id: `type-${row.lodgeName}-${row.roomTypeName}-${row.onDate}`,
          kind: 'OVERBOOKED_ROOM_TYPE',
          lodgeName: row.lodgeName,
          onDate: row.onDate,
        }),
      ),
    ];
    return conflicts.sort((a, b) => a.onDate.localeCompare(b.onDate));
  }
}
