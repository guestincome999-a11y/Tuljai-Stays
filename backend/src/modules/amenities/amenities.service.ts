import { Injectable } from '@nestjs/common';
import type { Amenity } from '@tuljai/types';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

import type { AssignLodgeAmenitiesDto, CreateAmenityDto } from './dto/amenity.dto';

@Injectable()
export class AmenitiesService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  public async listActive(): Promise<Amenity[]> {
    const amenities = await this.prisma.amenity.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      where: { deletedAt: null, isActive: true },
    });

    return amenities.map((amenity) => this.toAmenity(amenity));
  }

  public async create(dto: CreateAmenityDto, actorUserId: string): Promise<Amenity> {
    const amenity = await this.prisma.amenity.create({
      data: {
        category: dto.category,
        iconName: dto.iconName,
        name: dto.name,
        slug: dto.slug,
      },
    });
    await this.auditLogService.create({
      action: 'AMENITY_CREATED',
      actorUserId,
      entityId: amenity.id,
      entityType: 'amenity',
    });

    return this.toAmenity(amenity);
  }

  public async assignToLodge(
    lodgeId: string,
    dto: AssignLodgeAmenitiesDto,
    actorUserId: string,
  ): Promise<{ success: true }> {
    await this.prisma.$transaction([
      this.prisma.lodgeAmenity.deleteMany({ where: { lodgeId } }),
      ...dto.amenityIds.map((amenityId) =>
        this.prisma.lodgeAmenity.create({
          data: { amenityId, lodgeId },
        }),
      ),
    ]);
    await this.auditLogService.create({
      action: 'LODGE_AMENITIES_UPDATED',
      actorUserId,
      entityId: lodgeId,
      entityType: 'lodge',
      metadata: { amenityIds: dto.amenityIds },
    });

    return { success: true };
  }

  private toAmenity(amenity: {
    category: Amenity['category'];
    iconName: string | null;
    id: string;
    isActive: boolean;
    name: string;
    slug: string;
  }): Amenity {
    return {
      category: amenity.category,
      iconName: amenity.iconName,
      id: amenity.id,
      isActive: amenity.isActive,
      name: amenity.name,
      slug: amenity.slug,
    };
  }
}
