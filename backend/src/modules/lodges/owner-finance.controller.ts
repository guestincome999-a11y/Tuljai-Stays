import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { CommissionPaymentService } from './commission-payment.service';
import { financeExport } from './finance-export';
import { OwnerFinanceService } from './owner-finance.service';

export class FinanceQuery {
  @IsOptional() @IsString() @MaxLength(10) startDate?: string;
  @IsOptional() @IsString() @MaxLength(10) endDate?: string;
  @IsOptional() @IsString() @MaxLength(10) day?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional()
  @IsIn(['PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED', 'REFUNDED', 'RECOVERY_REQUIRED'])
  status?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsUUID() lodgeId?: string;
  @IsOptional() @IsIn(['date', 'amount']) sort?: string;
  @IsOptional() @IsIn(['asc', 'desc']) direction?: string;
  @IsOptional() @IsIn(['csv', 'pdf']) format?: string;
  @IsOptional() @IsIn(['revenue', 'commission']) kind?: string;
}
class CreateCommissionOrder {
  @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) expectedPaise!: number;
  @IsOptional() @IsIn(['FULL', 'PARTIAL']) paymentMode?: 'FULL' | 'PARTIAL';
}
class VerifyCommissionOrder {
  @IsString() @MaxLength(100) orderId!: string;
  @IsString() @MaxLength(100) paymentId!: string;
  @IsString() @MaxLength(200) signature!: string;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OwnerFinanceController {
  public constructor(
    private readonly finance: OwnerFinanceService,
    private readonly payments: CommissionPaymentService,
  ) {}

  @Get('owner/lodges/:id/finance')
  @Roles('OWNER', 'ADMIN')
  public owner(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinanceQuery,
  ) {
    return this.finance.owner(
      id,
      user,
      query.day ? { ...query, startDate: query.day, endDate: query.day } : query,
    );
  }
  @Get('owner/lodges/:id/finance/summary')
  @Roles('OWNER', 'ADMIN')
  public summary(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.owner(id, user, {}, true);
  }

  @Get('owner/lodges/:id/finance/settlements/:settlementId')
  @Roles('OWNER', 'ADMIN')
  public settlement(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('settlementId', ParseUUIDPipe) settlementId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinanceQuery,
  ) {
    return this.finance.settlement(id, settlementId, user, query.page, query.limit);
  }

  @Get('owner/lodges/:id/finance/settlements/:settlementId/export')
  @Roles('OWNER', 'ADMIN')
  public async settlementExport(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('settlementId', ParseUUIDPipe) settlementId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinanceQuery,
  ) {
    const rows: string[][] = [];
    let page = 1,
      total = 0;
    const first = await this.finance.settlement(id, settlementId, user, 1, 500);
    do {
      const result =
        page === 1 ? first : await this.finance.settlement(id, settlementId, user, page, 500);
      total = result.totalItems;
      rows.push(...result.bookings.map((b) => [b.bookingCode, b.bookingId, b.commission]));
      page++;
    } while (rows.length < total);
    rows.push(
      ['TOTAL COMMISSION DEDUCTED', '', first.commissionDeducted],
      ['AMOUNT TRANSFERRED', '', first.amount],
    );
    return financeExport(
      'Revenue Settlement Receipt',
      `Settlement ${first.id} | ${first.settledAt} | Reference ${first.reference ?? 'not recorded'} | Bank ${first.bankName ?? 'not recorded'} **** ${first.accountLast4 ?? ''} | INR`,
      ['Booking', 'Booking ID', 'Commission deducted INR'],
      rows,
      query.format,
    );
  }
  @Post('owner/lodges/:id/commission/payments')
  @Roles('OWNER')
  public create(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommissionOrder,
  ) {
    return this.payments.create(id, user, dto.expectedPaise, dto.paymentMode);
  }

  @Get('owner/lodges/:id/commission/payments')
  @Roles('OWNER', 'ADMIN')
  public ownerPayments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinanceQuery,
  ) {
    return this.finance.ownerPayments(id, user, query.page, query.limit);
  }

  @Get('owner/commission/payments/:id')
  @Roles('OWNER', 'ADMIN')
  public detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.detail(id, user);
  }

  @Post('owner/commission/payments/:id/cancelled')
  @Roles('OWNER')
  public cancelled(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.cancelled(id, user);
  }

  @Post('owner/commission/payments/:id/verify')
  @Roles('OWNER')
  public verify(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyCommissionOrder,
  ) {
    return this.payments.verify(id, user, dto);
  }

  @Post('owner/commission/payments/:id/reconcile')
  @Roles('OWNER', 'ADMIN')
  public async ownerReconcile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.payments.detail(id, user);
    await this.payments.reconcile(id);
    return this.payments.detail(id, user);
  }

  @Get('admin/commission/payments')
  @Roles('ADMIN')
  public history(@Query() query: FinanceQuery) {
    return this.finance.history(query);
  }

  @Get('admin/commission/outstanding/export')
  @Roles('ADMIN')
  public async outstandingExport(@Query() query: FinanceQuery) {
    const rows = await this.finance.outstandingExportRows();
    return financeExport(
      'Owner Outstanding Commission',
      'All-time unpaid lodge-collected commission | INR',
      ['Owner ID', 'Owner', 'Lodge', 'Bookings', 'Outstanding INR'],
      [
        ...rows.map((r) => [r.ownerId ?? '', r.owner, r.lodge, String(r.bookings), r.amount]),
        [
          'TOTAL',
          '',
          '',
          '',
          String(rows.reduce((s, r) => s + Math.round(Number(r.amount) * 100), 0) / 100),
        ],
      ],
      query.format,
    );
  }
  @Get('admin/commission/collections/export')
  @Roles('ADMIN')
  public async collectionsExport(@Query() query: FinanceQuery) {
    const rows = await this.finance.dailyExportRows(query);
    return financeExport(
      'Daily Commission Collections',
      `${query.startDate ?? 'All dates'} to ${query.endDate ?? 'present'} | Verified payment dates (IST) | INR`,
      ['Date (IST)', 'Payments', 'Commission received INR'],
      [
        ...rows.map((r) => [r.date, String(r.payments), r.amount]),
        [
          'TOTAL',
          String(rows.reduce((s, r) => s + r.payments, 0)),
          String(rows.reduce((s, r) => s + Math.round(Number(r.amount) * 100), 0) / 100),
        ],
      ],
      query.format,
    );
  }

  @Get('admin/commission/payments/export')
  @Roles('ADMIN')
  public async exportHistory(@Query() query: FinanceQuery) {
    const rows: string[][] = [];
    let page = 1;
    let total = 0;
    do {
      const result = await this.finance.history({ ...query, page, limit: 500 });
      total = result.totalItems;
      rows.push(
        ...result.items.map((p) => [
          p.verifiedAt ?? p.createdAt,
          p.ownerName,
          p.lodgeName,
          p.ownerId,
          p.id,
          p.orderId ?? '',
          p.paymentId ?? '',
          (p.amountPaise / 100).toFixed(2),
          p.method ?? '',
          p.status,
          p.paymentType,
          p.outstandingBeforePaise === null ? '' : (p.outstandingBeforePaise / 100).toFixed(2),
          p.remainingAfterPaise === null ? '' : (p.remainingAfterPaise / 100).toFixed(2),
          (p.currentOutstandingPaise / 100).toFixed(2),
        ]),
      );
      page++;
    } while (rows.length < total);
    const received =
      rows
        .filter((r) => r[9] === 'SUCCESSFUL')
        .reduce((sum, r) => sum + Math.round(Number(r[7]) * 100), 0) / 100;
    rows.push([
      'TOTAL VERIFIED RECEIVED',
      '',
      '',
      '',
      '',
      '',
      '',
      received.toFixed(2),
      '',
      'SUCCESSFUL',
      '',
      '',
      '',
      '',
    ]);
    return financeExport(
      'Commission Collection History',
      `${query.startDate ?? 'All dates'} to ${query.endDate ?? 'present'} | INR`,
      [
        'Date',
        'Owner',
        'Lodge',
        'Owner ID',
        'Reference',
        'Order',
        'Payment',
        'INR',
        'Method',
        'Status',
        'Payment type',
        'Outstanding at order INR',
        'Remaining after verification INR',
        'Current outstanding INR',
      ],
      rows,
      query.format,
    );
  }
  @Get('admin/commission/payments/:id')
  @Roles('ADMIN')
  public adminDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.payments.detail(id);
  }

  @Post('admin/commission/payments/:id/reconcile')
  @Roles('ADMIN')
  public async reconcile(@Param('id', ParseUUIDPipe) id: string) {
    await this.payments.reconcile(id);
    return this.payments.detail(id);
  }

  @Get('owner/commission/payments/:id/receipt')
  @Roles('OWNER', 'ADMIN')
  public async receipt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const p = await this.payments.detail(id, user);
    if (p.status !== 'SUCCESSFUL')
      throw new BadRequestException('Receipt available after verified payment only');
    return financeExport(
      'Commission Payment Receipt',
      `${p.ownerName} | ${p.lodgeName} | ${p.verifiedAt} | ${p.paymentType} payment | Reference ${p.id} | ${p.orderId} | ${p.paymentId} | Outstanding at order: INR ${p.outstandingBeforePaise === null ? 'not recorded' : (p.outstandingBeforePaise / 100).toFixed(2)} | Remaining after verification: INR ${p.remainingAfterPaise === null ? 'not recorded' : (p.remainingAfterPaise / 100).toFixed(2)}`,
      [
        'Booking',
        'Ledger reference',
        'Paid on this receipt (INR)',
        'Booking remaining after this payment (INR)',
      ],
      [
        ...p.bookings.map((b) => [
          b.bookingCode,
          b.ledgerId,
          (b.amountPaise / 100).toFixed(2),
          ((b.dueBeforePaise - b.amountPaise) / 100).toFixed(2),
        ]),
        ['TOTAL', p.id, (p.amountPaise / 100).toFixed(2), ''],
      ],
    );
  }
  @Get('owner/lodges/:id/finance/export')
  @Roles('OWNER', 'ADMIN')
  public async exportOwner(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinanceQuery,
  ) {
    const q = query.day ? { ...query, startDate: query.day, endDate: query.day } : query;
    if (!query.day) {
      const dateRows: string[][] = [];
      let datePage = 1,
        dateCount = 0,
        bookings = 0,
        revenue = '0',
        commission = '0',
        lodgeName = '';
      do {
        const result = await this.finance.owner(id, user, { ...q, page: datePage, limit: 500 });
        dateCount = result.totalItems;
        lodgeName = result.lodgeName;
        bookings = result.summary.bookings;
        revenue = result.summary.revenue;
        commission = result.summary.commission;
        dateRows.push(
          ...result.days.map((d) => [d.date, String(d.bookings), d.revenue, d.commission]),
        );
        datePage++;
      } while (dateRows.length < dateCount);
      dateRows.push(['TOTAL', String(bookings), revenue, commission]);
      return financeExport(
        query.kind === 'commission'
          ? 'Date-wise Commission Settlement'
          : 'Date-wise Revenue Settlement',
        `${lodgeName} | ${q.startDate ?? 'All dates'} to ${q.endDate ?? 'present'} | Booking creation dates (IST) | INR`,
        ['Date (IST)', 'Bookings', 'Eligible revenue INR', 'Commission INR'],
        dateRows,
        query.format,
      );
    }
    const rows: string[][] = [];
    let page = 1,
      total = 0,
      lodge = '';
    do {
      const result = await this.finance.owner(id, user, { ...q, day: 'export', page, limit: 500 });
      total = result.summary.bookings;
      lodge = result.lodgeName;
      rows.push(
        ...result.bookings.map((b) => [
          b.bookingCode,
          b.guestName,
          b.createdAt,
          b.paymentStatus,
          b.status,
          b.amount,
          b.revenue,
          b.commission,
        ]),
      );
      page++;
    } while (rows.length < total);
    const sum = (i: number) => rows.reduce((s, r) => s + Math.round(Number(r[i]) * 100), 0) / 100;
    const totals = [sum(5), sum(6), sum(7)];
    rows.push(['TOTAL', String(total), '', '', '', ...totals.map((n) => n.toFixed(2))]);
    return financeExport(
      query.kind === 'commission' ? 'Booking Commission Settlement' : 'Revenue Settlement',
      `${lodge} | ${q.startDate ?? 'All dates'} to ${q.endDate ?? 'present'} | Booking creation dates (IST) | INR`,
      [
        'Booking',
        'Guest',
        'Booked at',
        'Payment',
        'Stay status',
        'Booking INR',
        'Eligible revenue INR',
        'Commission INR',
      ],
      rows,
      query.format,
    );
  }
}
