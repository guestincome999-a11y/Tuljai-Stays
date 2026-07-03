import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CheckoutResponse,
  GuestRegister,
  PaginatedResponse,
} from '@tuljai/types';
import { normalizePagination } from '@tuljai/utils';

import { Prisma } from '../../../generated/prisma';
import { LodgeAccessService } from '../lodges/lodge-access.service';
import { PrismaService } from '../prisma/prisma.service';

import { BookingHistoryService } from './booking-history.service';
import type {
  MarkIdVerifiedDto,
  RegisterQueryDto,
  UpdateRegisterNotesDto,
} from './dto/qr-register.dto';

type GuestRegisterWithRelations = Prisma.GuestRegisterGetPayload<{
  include: {
    idDocuments: true;
    room: true;
    roomType: true;
  };
}>;

type BookingForRegister = Prisma.BookingGetPayload<{
  include: {
    room: true;
    roomType: true;
  };
}>;

@Injectable()
export class GuestRegisterService {
  public constructor(
    private readonly bookingHistoryService: BookingHistoryService,
    private readonly lodgeAccessService: LodgeAccessService,
    private readonly prisma: PrismaService,
  ) {}

  public async createFromBooking(input: {
    actorUserId: string;
    booking: BookingForRegister;
    qrTokenId: string;
  }): Promise<GuestRegister> {
    const register = await this.prisma.guestRegister.upsert({
      create: {
        alternatePhone: input.booking.alternatePhone,
        bookingCode: input.booking.bookingCode,
        bookingId: input.booking.id,
        checkInAt: input.booking.checkedInAt ?? new Date(),
        createdByUserId: input.actorUserId,
        expectedCheckoutAt: input.booking.checkOutDate,
        guestAddress: input.booking.guestAddress,
        guestEmail: input.booking.guestEmail,
        lodgeId: input.booking.lodgeId,
        numberOfAdults: input.booking.numberOfAdults,
        numberOfChildren: input.booking.numberOfChildren,
        pilgrimUserId: input.booking.pilgrimUserId,
        primaryGuestName: input.booking.guestName,
        primaryGuestPhone: input.booking.guestPhone,
        qrTokenId: input.qrTokenId,
        registerCode: await this.generateRegisterCode(),
        roomId: input.booking.roomId,
        roomTypeId: input.booking.roomTypeId,
        totalGuests: input.booking.totalGuests,
      },
      include: this.registerInclude,
      update: {
        qrTokenId: input.qrTokenId,
        updatedByUserId: input.actorUserId,
      },
      where: { bookingId: input.booking.id },
    });
    await this.createRegisterAuditLog(register.id, input.actorUserId, 'REGISTER_CREATED');

    return this.toGuestRegister(register);
  }

  public async listOwnerRegisters(
    query: RegisterQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<GuestRegister>> {
    if (query.lodgeId) {
      await this.lodgeAccessService.assertCanManageLodge(user, query.lodgeId);
    }

    return this.listRegisters(query, user);
  }

  public async listAdminRegisters(
    query: RegisterQueryDto,
  ): Promise<PaginatedResponse<GuestRegister>> {
    return this.listRegisters(query);
  }

  public async getRegister(id: string, user: AuthenticatedUser): Promise<GuestRegister> {
    const register = await this.findRegisterOrThrow(id);
    await this.lodgeAccessService.assertCanManageLodge(user, register.lodgeId);
    await this.createRegisterAuditLog(id, user.id, 'DETAILS_VIEWED');

    return this.toGuestRegister(register);
  }

  public async markIdVerified(
    id: string,
    dto: MarkIdVerifiedDto,
    user: AuthenticatedUser,
  ): Promise<GuestRegister> {
    const existing = await this.findRegisterOrThrow(id);
    await this.lodgeAccessService.assertCanManageLodge(user, existing.lodgeId);

    const register = await this.prisma.guestRegister.update({
      data: {
        governmentIdNumber: dto.governmentIdNumber,
        governmentIdType: dto.governmentIdType,
        idVerified: true,
        updatedByUserId: user.id,
        ...(dto.governmentIdNumber && dto.governmentIdType
          ? {
              idDocuments: {
                create: {
                  documentHolderName: dto.documentHolderName,
                  documentNumber: dto.governmentIdNumber,
                  documentType: dto.governmentIdType,
                  verifiedAt: new Date(),
                  verifiedByUserId: user.id,
                },
              },
            }
          : {}),
      },
      include: this.registerInclude,
      where: { id },
    });
    await this.createRegisterAuditLog(id, user.id, 'ID_MARKED_VERIFIED', {
      governmentIdType: dto.governmentIdType,
    });

    return this.toGuestRegister(register);
  }

  public async updateNotes(
    id: string,
    dto: UpdateRegisterNotesDto,
    user: AuthenticatedUser,
  ): Promise<GuestRegister> {
    const existing = await this.findRegisterOrThrow(id);
    await this.lodgeAccessService.assertCanManageLodge(user, existing.lodgeId);
    const register = await this.prisma.guestRegister.update({
      data: {
        ownerNotes: dto.ownerNotes,
        updatedByUserId: user.id,
      },
      include: this.registerInclude,
      where: { id },
    });
    await this.createRegisterAuditLog(id, user.id, 'NOTES_UPDATED');

    return this.toGuestRegister(register);
  }

  public async checkout(id: string, user: AuthenticatedUser): Promise<CheckoutResponse> {
    const existing = await this.findRegisterOrThrow(id);
    await this.lodgeAccessService.assertCanManageLodge(user, existing.lodgeId);

    if (existing.status !== 'CHECKED_IN') {
      throw new BadRequestException('Only checked-in registers can be checked out');
    }

    const checkedOutAt = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        data: {
          checkedOutAt,
          status: 'CHECKED_OUT',
        },
        include: {
          city: true,
          guests: { where: { deletedAt: null } },
          lodge: true,
          room: true,
          roomType: true,
        },
        where: { id: existing.bookingId },
      });
      const register = await tx.guestRegister.update({
        data: {
          actualCheckoutAt: checkedOutAt,
          status: 'CHECKED_OUT',
          updatedByUserId: user.id,
        },
        include: this.registerInclude,
        where: { id },
      });

      const checkoutRoom = existing.room;

      if (
        existing.roomId &&
        checkoutRoom &&
        checkoutRoom.status !== 'MAINTENANCE' &&
        checkoutRoom.status !== 'BLOCKED'
      ) {
        await tx.room.update({
          data: { status: 'AVAILABLE' },
          where: { id: existing.roomId },
        });
        await tx.roomStatusHistory.create({
          data: {
            actorUserId: user.id,
            bookingId: existing.bookingId,
            fromStatus: checkoutRoom.status,
            reason: 'CHECKOUT_MARKED',
            roomId: existing.roomId,
            toStatus: 'AVAILABLE',
          },
        });
      }

      await tx.bookingHistory.create({
        data: {
          action: 'BOOKING_CHECKED_OUT',
          actorUserId: user.id,
          bookingId: existing.bookingId,
          fromStatus: 'CHECKED_IN',
          toStatus: 'CHECKED_OUT',
        },
      });

      return { booking, register };
    });
    await this.createRegisterAuditLog(id, user.id, 'CHECKOUT_MARKED');

    return {
      booking: this.toBooking(result.booking),
      register: this.toGuestRegister(result.register),
    };
  }

  public async createRegisterAuditLog(
    guestRegisterId: string,
    actorUserId: string | null,
    action: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.registerAuditLog.create({
      data: {
        action,
        actorUserId,
        guestRegisterId,
        metadata,
      },
    });
  }

  private readonly registerInclude = {
    idDocuments: {
      where: { deletedAt: null },
    },
    room: true,
    roomType: true,
  } satisfies Prisma.GuestRegisterInclude;

  private async findRegisterOrThrow(id: string): Promise<GuestRegisterWithRelations> {
    const register = await this.prisma.guestRegister.findFirst({
      include: this.registerInclude,
      where: { deletedAt: null, id },
    });

    if (!register) {
      throw new NotFoundException('Guest register not found');
    }

    return register;
  }

  private async generateRegisterCode(): Promise<string> {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.guestRegister.count();

    return `REG-${datePart}-${String(count + 1).padStart(6, '0')}`;
  }

  private async listRegisters(
    query: RegisterQueryDto,
    user?: AuthenticatedUser,
  ): Promise<PaginatedResponse<GuestRegister>> {
    const pagination = normalizePagination(query.page, query.limit);
    const where: Prisma.GuestRegisterWhereInput = {
      deletedAt: null,
      ...(query.lodgeId ? { lodgeId: query.lodgeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.date
        ? {
            checkInAt: {
              gte: new Date(`${query.date.slice(0, 10)}T00:00:00.000Z`),
              lt: new Date(`${query.date.slice(0, 10)}T23:59:59.999Z`),
            },
          }
        : {}),
      ...(query.roomNumber ? { room: { roomNumber: { contains: query.roomNumber } } } : {}),
      ...(query.guestName
        ? { primaryGuestName: { contains: query.guestName, mode: 'insensitive' } }
        : {}),
      ...(query.phone ? { primaryGuestPhone: { contains: query.phone } } : {}),
      ...(query.bookingCode ? { bookingCode: { contains: query.bookingCode } } : {}),
      ...(user && !this.lodgeAccessService.isAdmin(user)
        ? {
            lodge: {
              owners: {
                some: {
                  deletedAt: null,
                  isActive: true,
                  userId: user.id,
                },
              },
            },
          }
        : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.guestRegister.findMany({
        include: this.registerInclude,
        orderBy: { checkInAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        where,
      }),
      this.prisma.guestRegister.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toGuestRegister(item)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }

  private toBooking(booking: Prisma.BookingGetPayload<{ include: { guests: true } }>) {
    return {
      acceptedByUserId: booking.acceptedByUserId,
      advanceAmount: booking.advanceAmount?.toString() ?? null,
      alternatePhone: booking.alternatePhone,
      balanceAmount: booking.balanceAmount?.toString() ?? null,
      bookingCode: booking.bookingCode,
      cancellationReason: booking.cancellationReason,
      checkInDate: booking.checkInDate.toISOString().slice(0, 10),
      checkOutDate: booking.checkOutDate.toISOString().slice(0, 10),
      checkedInAt: booking.checkedInAt?.toISOString() ?? null,
      checkedOutAt: booking.checkedOutAt?.toISOString() ?? null,
      cityId: booking.cityId,
      commissionAmount: booking.commissionAmount?.toString() ?? null,
      createdAt: booking.createdAt.toISOString(),
      expectedCheckInTime: booking.expectedCheckInTime,
      expectedCheckOutTime: booking.expectedCheckOutTime,
      guestAddress: booking.guestAddress,
      guestEmail: booking.guestEmail,
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      guests: booking.guests.map((guest) => ({
        age: guest.age,
        fullName: guest.fullName,
        gender: guest.gender,
        id: guest.id,
        idNumber: guest.idNumber,
        idType: guest.idType,
        isPrimaryGuest: guest.isPrimaryGuest,
        phone: guest.phone,
      })),
      id: booking.id,
      lodgeId: booking.lodgeId,
      numberOfAdults: booking.numberOfAdults,
      numberOfChildren: booking.numberOfChildren,
      ownerResponseDeadline: booking.ownerResponseDeadline?.toISOString() ?? null,
      paymentStatus: booking.paymentStatus,
      pilgrimUserId: booking.pilgrimUserId,
      rejectedByUserId: booking.rejectedByUserId,
      rejectedReason: booking.rejectedReason,
      roomId: booking.roomId,
      roomTypeId: booking.roomTypeId,
      specialRequest: booking.specialRequest,
      status: booking.status,
      totalAmount: booking.totalAmount?.toString() ?? null,
      totalGuests: booking.totalGuests,
      updatedAt: booking.updatedAt.toISOString(),
    };
  }

  private toGuestRegister(register: GuestRegisterWithRelations): GuestRegister {
    return {
      actualCheckoutAt: register.actualCheckoutAt?.toISOString() ?? null,
      alternatePhone: register.alternatePhone,
      bookingCode: register.bookingCode,
      bookingId: register.bookingId,
      checkInAt: register.checkInAt.toISOString(),
      expectedCheckoutAt: register.expectedCheckoutAt?.toISOString() ?? null,
      governmentIdNumber: register.governmentIdNumber,
      governmentIdType: register.governmentIdType,
      guestAddress: register.guestAddress,
      guestEmail: register.guestEmail,
      id: register.id,
      idDocuments: register.idDocuments.map((document) => ({
        documentHolderName: document.documentHolderName,
        documentNumber: document.documentNumber,
        documentType: document.documentType,
        id: document.id,
        verifiedAt: document.verifiedAt?.toISOString() ?? null,
        verifiedByUserId: document.verifiedByUserId,
      })),
      idVerified: register.idVerified,
      lodgeId: register.lodgeId,
      numberOfAdults: register.numberOfAdults,
      numberOfChildren: register.numberOfChildren,
      ownerNotes: register.ownerNotes,
      pilgrimUserId: register.pilgrimUserId,
      primaryGuestName: register.primaryGuestName,
      primaryGuestPhone: register.primaryGuestPhone,
      qrTokenId: register.qrTokenId,
      registerCode: register.registerCode,
      roomId: register.roomId,
      roomNumber: register.room?.roomNumber ?? null,
      roomTypeId: register.roomTypeId,
      roomTypeName: register.roomType.name,
      status: register.status,
      totalGuests: register.totalGuests,
    };
  }
}
