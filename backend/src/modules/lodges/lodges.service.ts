import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AuthenticatedUser,
  BulkLodgeImportResult,
  Lodge,
  LodgeDetails,
  PaginatedResponse,
} from '@tuljai/types';
import { normalizePagination } from '@tuljai/utils';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

import type {
  BulkImportLodgesDto,
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
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  public async create(dto: CreateLodgeDto, actorUserId: string): Promise<LodgeDetails> {
    const duplicate = await this.prisma.lodge.findFirst({
      select: { id: true },
      where: {
        cityId: dto.cityId,
        slug: dto.slug,
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'This lodge URL slug is already in use for the selected city. Choose a different slug.',
      );
    }

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

  public async bulkImport(
    dto: BulkImportLodgesDto,
    actorUserId: string,
  ): Promise<BulkLodgeImportResult> {
    const citySlugs = [...new Set(dto.rows.map((row) => row.citySlug.toLowerCase()))];
    const ownerPhones = [...new Set(dto.rows.map((row) => row.ownerPhone))];
    const ownerEmails = [
      ...new Set(
        dto.rows
          .map((row) => row.ownerEmail?.trim().toLowerCase())
          .filter((email): email is string => Boolean(email)),
      ),
    ];
    const amenitySlugs = [
      ...new Set(
        dto.rows.flatMap((row) => row.amenitySlugs ?? []).map((slug) => slug.toLowerCase()),
      ),
    ];

    const [cities, owners, amenities] = await Promise.all([
      this.prisma.city.findMany({
        select: { id: true, slug: true },
        where: { deletedAt: null, isActive: true, slug: { in: citySlugs } },
      }),
      this.prisma.user.findMany({
        include: { authIdentities: { select: { email: true } } },
        where: {
          deletedAt: null,
          isActive: true,
          OR: [
            { phoneNumber: { in: ownerPhones } },
            ...(ownerEmails.length
              ? [
                  {
                    authIdentities: {
                      some: { email: { in: ownerEmails, mode: Prisma.QueryMode.insensitive } },
                    },
                  } satisfies Prisma.UserWhereInput,
                ]
              : []),
          ],
        },
      }),
      this.prisma.amenity.findMany({
        select: { id: true, slug: true },
        where: { deletedAt: null, isActive: true, slug: { in: amenitySlugs } },
      }),
    ]);

    const citiesBySlug = new Map(cities.map((city) => [city.slug.toLowerCase(), city]));
    const amenitiesBySlug = new Map(
      amenities.map((amenity) => [amenity.slug.toLowerCase(), amenity]),
    );
    const ownersByPhone = new Map(
      owners.filter((owner) => owner.phoneNumber).map((owner) => [owner.phoneNumber!, owner]),
    );
    const ownersByEmail = new Map<string, typeof owners>();

    for (const owner of owners) {
      for (const identity of owner.authIdentities) {
        const email = identity.email?.trim().toLowerCase();
        if (!email) continue;
        ownersByEmail.set(email, [...(ownersByEmail.get(email) ?? []), owner]);
      }
    }

    const resolvedRows = dto.rows.map((row) => {
      const city = citiesBySlug.get(row.citySlug.toLowerCase());
      const phoneOwner = ownersByPhone.get(row.ownerPhone);
      const emailOwners = row.ownerEmail
        ? (ownersByEmail.get(row.ownerEmail.trim().toLowerCase()) ?? [])
        : [];
      const owner = phoneOwner ?? (emailOwners.length === 1 ? emailOwners[0] : undefined);
      const rowAmenities = (row.amenitySlugs ?? []).map((slug) =>
        amenitiesBySlug.get(slug.toLowerCase()),
      );

      return { city, emailOwners, owner, phoneOwner, row, rowAmenities };
    });

    const errors: string[] = [];
    const seenLodgeKeys = new Set<string>();

    for (const item of resolvedRows) {
      const { city, emailOwners, owner, phoneOwner, row, rowAmenities } = item;
      if (!city) errors.push(`Row ${row.rowNumber}: city_slug "${row.citySlug}" was not found.`);
      if (!owner) {
        errors.push(
          `Row ${row.rowNumber}: no active owner account matched ${row.ownerPhone}${
            row.ownerEmail ? ` or ${row.ownerEmail}` : ''
          }.`,
        );
      }
      if (!phoneOwner && emailOwners.length > 1) {
        errors.push(`Row ${row.rowNumber}: owner_email matches more than one account.`);
      }
      if (phoneOwner && emailOwners.some((emailOwner) => emailOwner.id !== phoneOwner.id)) {
        errors.push(`Row ${row.rowNumber}: owner_phone and owner_email match different accounts.`);
      }
      const missingAmenities = (row.amenitySlugs ?? []).filter(
        (_slug, index) => !rowAmenities[index],
      );
      if (missingAmenities.length) {
        errors.push(
          `Row ${row.rowNumber}: unknown amenity slug(s): ${missingAmenities.join(', ')}.`,
        );
      }
      if (city) {
        const lodgeKey = `${city.id}:${row.slug.toLowerCase()}`;
        if (seenLodgeKeys.has(lodgeKey)) {
          errors.push(`Row ${row.rowNumber}: the city and slug are duplicated in this file.`);
        }
        seenLodgeKeys.add(lodgeKey);
      }
    }

    const existingLodges = await this.prisma.lodge.findMany({
      select: { cityId: true, slug: true },
      where: {
        cityId: { in: cities.map((city) => city.id) },
        deletedAt: null,
        slug: { in: dto.rows.map((row) => row.slug) },
      },
    });
    const existingKeys = new Set(
      existingLodges.map((lodge) => `${lodge.cityId}:${lodge.slug.toLowerCase()}`),
    );

    for (const item of resolvedRows) {
      if (item.city && existingKeys.has(`${item.city.id}:${item.row.slug.toLowerCase()}`)) {
        errors.push(
          `Row ${item.row.rowNumber}: slug "${item.row.slug}" already exists in that city.`,
        );
      }
    }

    if (errors.length) {
      throw new BadRequestException({
        error: 'LODGE_IMPORT_VALIDATION_FAILED',
        message: errors.slice(0, 25),
      });
    }

    const batchId = randomUUID();
    const importedItems = await this.prisma.$transaction(
      async (tx) => {
        const promotedOwnerIds = new Set<string>();
        const items: BulkLodgeImportResult['items'] = [];

        for (const item of resolvedRows) {
          const city = item.city!;
          const owner = item.owner!;
          const row = item.row;
          const publishLive = row.publishLive ?? false;

          if (!owner.roles.includes('OWNER') && !promotedOwnerIds.has(owner.id)) {
            await tx.user.update({
              data: { roles: { push: 'OWNER' } },
              where: { id: owner.id },
            });
            promotedOwnerIds.add(owner.id);
          }

          const lodge = await tx.lodge.create({
            data: {
              address: { create: row.address },
              amenities: {
                create: item.rowAmenities.map((amenity) => ({ amenityId: amenity!.id })),
              },
              checkInTime: row.checkInTime,
              checkOutTime: row.checkOutTime,
              cityId: city.id,
              description: row.description,
              distanceFromTempleMeters: row.distanceFromTempleMeters,
              email: row.email,
              latitude: row.latitude,
              longitude: row.longitude,
              name: row.name,
              ownerUserId: owner.id,
              owners: {
                create: {
                  isPrimary: true,
                  ownerEmail: row.ownerEmail,
                  ownerName: row.ownerName ?? owner.displayName ?? 'Lodge owner',
                  ownerPhone: row.ownerPhone,
                  roleTitle: row.ownerRoleTitle ?? 'Primary owner',
                  userId: owner.id,
                },
              },
              primaryPhone: row.primaryPhone,
              propertyType: row.propertyType,
              rules: row.rules,
              secondaryPhone: row.secondaryPhone,
              slug: row.slug,
              status: publishLive ? 'VERIFIED' : 'DRAFT',
              verificationLogs: publishLive
                ? {
                    create: {
                      notes: `Published during Excel bulk import ${batchId}`,
                      reviewedByUserId: actorUserId,
                      status: 'VERIFIED',
                    },
                  }
                : undefined,
              verificationStatus: publishLive ? 'VERIFIED' : 'PENDING',
              whatsappNumber: row.whatsappNumber,
            },
            select: { id: true, name: true },
          });

          await tx.auditLog.create({
            data: {
              action: 'LODGE_BULK_IMPORTED',
              actorUserId,
              entityId: lodge.id,
              entityType: 'lodge',
              metadata: { batchId, published: publishLive, rowNumber: row.rowNumber },
            },
          });

          items.push({
            lodgeId: lodge.id,
            name: lodge.name,
            ownerUserId: owner.id,
            published: publishLive,
            rowNumber: row.rowNumber,
          });
        }

        return items;
      },
      { maxWait: 10_000, timeout: 120_000 },
    );

    const publishedCount = importedItems.filter((item) => item.published).length;
    const payload = {
      batchId,
      importedCount: importedItems.length,
      lodgeIds: importedItems.map((item) => item.lodgeId),
      publishedCount,
      updatedAt: new Date().toISOString(),
    };
    this.realtimeEventsService.publishToRole('PILGRIM', 'lodge:catalog-updated', payload);
    this.realtimeEventsService.publishToRole('ADMIN', 'lodge:catalog-updated', payload);
    for (const ownerUserId of new Set(importedItems.map((item) => item.ownerUserId))) {
      this.realtimeEventsService.publishToUser(ownerUserId, 'lodge:catalog-updated', payload);
    }

    return {
      batchId,
      importedCount: importedItems.length,
      items: importedItems,
      ownerAssignments: importedItems.length,
      publishedCount,
    };
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

  public async listAdmin(query: ListLodgesQueryDto): Promise<PaginatedResponse<Lodge>> {
    const pagination = normalizePagination(query.page, query.pageSize);
    const where: Prisma.LodgeWhereInput = {
      deletedAt: null,
      ...(query.propertyType ? { propertyType: query.propertyType } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.citySlug ? { city: { slug: query.citySlug } } : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.lodge.findMany({
        orderBy: { createdAt: 'desc' },
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

  public async getAdminById(id: string): Promise<LodgeDetails> {
    const lodge = await this.prisma.lodge.findFirst({
      include: this.detailInclude,
      where: {
        deletedAt: null,
        id,
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
