import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser, Lodge, LodgeDetails, PaginatedResponse } from '@tuljai/types';
import { normalizePagination } from '@tuljai/utils';

import { Prisma } from '../../../generated/prisma';
import { AuditLogService } from '../../shared/audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

import type {
  CreateLodgeDto,
  ListLodgesQueryDto,
  UpdateLodgeDto,
  UpdateLodgeStatusDto,
  VerifyLodgeDto,
} from './dto/lodge.dto';

@Injectable()
export class LodgesService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  public async create(dto: CreateLodgeDto, actorUserId: string): Promise<LodgeDetails> {
    const lodge = await this.prisma.lodge.create({
      data: {
        checkInTime: dto.checkInTime,
        checkOutTime: dto.checkOutTime,
        cityId: dto.cityId,
        description: dto.description,
        distanceFromTempleMeters: dto.distanceFromTempleMeters,
        email: dto.email,
        latitude: dto.latitude,
        longitude: dto.longitude,
        name: dto.name,
        ownerUserId: dto.ownerUserId,
        primaryPhone: dto.primaryPhone,
        propertyType: dto.propertyType,
        rules: dto.rules,
        secondaryPhone: dto.secondaryPhone,
        slug: dto.slug,
        whatsappNumber: dto.whatsappNumber,
        ...(dto.address
          ? {
              address: {
                create: {
                  addressLine1: dto.address.addressLine1,
                  addressLine2: dto.address.addressLine2,
                  city: dto.address.city,
                  country: dto.address.country,
                  district: dto.address.district,
                  landmark: dto.address.landmark,
                  pincode: dto.address.pincode,
                  state: dto.address.state,
                },
              },
            }
          : {}),
      },
      include: this.detailInclude,
    });

    await this.auditLogService.create({
      action: 'LODGE_CREATED',
      actorUserId,
      entityId: lodge.id,
      entityType: 'lodge',
    });

    return this.toLodgeDetails(lodge);
  }

  public async listPublic(query: ListLodgesQueryDto): Promise<PaginatedResponse<Lodge>> {
    const pagination = normalizePagination(query.page, query.pageSize);
    const where: Prisma.LodgeWhereInput = {
      deletedAt: null,
      isActive: true,
      status: 'VERIFIED',
      verificationStatus: 'VERIFIED',
      ...(query.propertyType ? { propertyType: query.propertyType } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(query.citySlug ? { city: { slug: query.citySlug } } : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.lodge.findMany({
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
        where,
      }),
      this.prisma.lodge.count({ where }),
    ]);

    return {
      items: items.map((lodge) => this.toLodge(lodge)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }

  public async getPublicById(id: string): Promise<LodgeDetails> {
    const lodge = await this.prisma.lodge.findFirst({
      include: this.detailInclude,
      where: {
        deletedAt: null,
        id,
        isActive: true,
        status: 'VERIFIED',
        verificationStatus: 'VERIFIED',
      },
    });

    if (!lodge) {
      throw new NotFoundException('Lodge not found');
    }

    return this.toLodgeDetails(lodge);
  }

  public async update(id: string, dto: UpdateLodgeDto, actorUserId: string): Promise<LodgeDetails> {
    const lodge = await this.prisma.lodge.update({
      data: {
        checkInTime: dto.checkInTime,
        checkOutTime: dto.checkOutTime,
        cityId: dto.cityId,
        description: dto.description,
        distanceFromTempleMeters: dto.distanceFromTempleMeters,
        email: dto.email,
        latitude: dto.latitude,
        longitude: dto.longitude,
        name: dto.name,
        ownerUserId: dto.ownerUserId,
        primaryPhone: dto.primaryPhone,
        propertyType: dto.propertyType,
        rules: dto.rules,
        secondaryPhone: dto.secondaryPhone,
        slug: dto.slug,
        whatsappNumber: dto.whatsappNumber,
        ...(dto.address
          ? {
              address: {
                upsert: {
                  create: {
                    addressLine1: dto.address.addressLine1,
                    addressLine2: dto.address.addressLine2,
                    city: dto.address.city,
                    country: dto.address.country,
                    district: dto.address.district,
                    landmark: dto.address.landmark,
                    pincode: dto.address.pincode,
                    state: dto.address.state,
                  },
                  update: {
                    addressLine1: dto.address.addressLine1,
                    addressLine2: dto.address.addressLine2,
                    city: dto.address.city,
                    country: dto.address.country,
                    district: dto.address.district,
                    landmark: dto.address.landmark,
                    pincode: dto.address.pincode,
                    state: dto.address.state,
                  },
                },
              },
            }
          : {}),
      },
      include: this.detailInclude,
      where: { id },
    });

    await this.auditLogService.create({
      action: 'LODGE_UPDATED',
      actorUserId,
      entityId: id,
      entityType: 'lodge',
    });

    return this.toLodgeDetails(lodge);
  }

  public async updateStatus(
    id: string,
    dto: UpdateLodgeStatusDto,
    actorUserId: string,
  ): Promise<LodgeDetails> {
    const lodge = await this.prisma.lodge.update({
      data: { status: dto.status },
      include: this.detailInclude,
      where: { id },
    });
    await this.auditLogService.create({
      action: 'LODGE_STATUS_UPDATED',
      actorUserId,
      entityId: id,
      entityType: 'lodge',
      metadata: { status: dto.status },
    });

    return this.toLodgeDetails(lodge);
  }

  public async verify(id: string, dto: VerifyLodgeDto, actorUserId: string): Promise<LodgeDetails> {
    const lodge = await this.prisma.lodge.update({
      data: {
        status: dto.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'REJECTED',
        verificationLogs: {
          create: {
            notes: dto.notes,
            reviewedByUserId: actorUserId,
            status: dto.verificationStatus,
          },
        },
        verificationStatus: dto.verificationStatus,
      },
      include: this.detailInclude,
      where: { id },
    });
    await this.auditLogService.create({
      action: 'LODGE_VERIFICATION_UPDATED',
      actorUserId,
      entityId: id,
      entityType: 'lodge',
      metadata: { verificationStatus: dto.verificationStatus },
    });

    return this.toLodgeDetails(lodge);
  }

  public async listForOwner(user: AuthenticatedUser): Promise<Lodge[]> {
    const lodges = await this.prisma.lodge.findMany({
      orderBy: { name: 'asc' },
      where: this.isAdmin(user)
        ? { deletedAt: null }
        : {
            deletedAt: null,
            owners: {
              some: {
                deletedAt: null,
                isActive: true,
                userId: user.id,
              },
            },
          },
    });

    return lodges.map((lodge) => this.toLodge(lodge));
  }

  private readonly detailInclude = {
    address: true,
    amenities: {
      include: {
        amenity: true,
      },
    },
  } satisfies Prisma.LodgeInclude;

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN');
  }

  private toLodge(lodge: {
    cityId: string;
    description: string | null;
    distanceFromTempleMeters: number | null;
    id: string;
    isActive: boolean;
    name: string;
    primaryPhone: string;
    propertyType: Lodge['propertyType'];
    slug: string;
    status: Lodge['status'];
    verificationStatus: Lodge['verificationStatus'];
  }): Lodge {
    return {
      cityId: lodge.cityId,
      description: lodge.description,
      distanceFromTempleMeters: lodge.distanceFromTempleMeters,
      id: lodge.id,
      isActive: lodge.isActive,
      name: lodge.name,
      primaryPhone: lodge.primaryPhone,
      propertyType: lodge.propertyType,
      slug: lodge.slug,
      status: lodge.status,
      verificationStatus: lodge.verificationStatus,
    };
  }

  private toLodgeDetails(
    lodge: Prisma.LodgeGetPayload<{ include: LodgesService['detailInclude'] }>,
  ): LodgeDetails {
    return {
      ...this.toLodge(lodge),
      address: lodge.address
        ? {
            addressLine1: lodge.address.addressLine1,
            addressLine2: lodge.address.addressLine2,
            city: lodge.address.city,
            country: lodge.address.country,
            district: lodge.address.district,
            landmark: lodge.address.landmark,
            pincode: lodge.address.pincode,
            state: lodge.address.state,
          }
        : null,
      amenities: lodge.amenities.map((item) => ({
        category: item.amenity.category,
        iconName: item.amenity.iconName,
        id: item.amenity.id,
        isActive: item.amenity.isActive,
        name: item.amenity.name,
        slug: item.amenity.slug,
      })),
      checkInTime: lodge.checkInTime,
      checkOutTime: lodge.checkOutTime,
      email: lodge.email,
      latitude: lodge.latitude?.toString() ?? null,
      longitude: lodge.longitude?.toString() ?? null,
      rules: lodge.rules,
      secondaryPhone: lodge.secondaryPhone,
      whatsappNumber: lodge.whatsappNumber,
    };
  }
}
