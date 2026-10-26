import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser, RoomType } from '@tuljai/types';

import { LodgeAccessService } from '../lodges/lodge-access.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Management view of a lodge's room types.
 *
 * Unlike the public pilgrim listing, this returns every non-deleted room type
 * (inactive ones, and ones with no AVAILABLE room, included) and does not
 * require the lodge to be VERIFIED. Otherwise a type disappears from the admin
 * and owner screens the moment it is deactivated or all its rooms are blocked,
 * and can no longer be edited or re-enabled.
 */
@Injectable()
export class RoomTypesAdminService {
  public constructor(
    private readonly lodgeAccessService: LodgeAccessService,
    private readonly prisma: PrismaService,
  ) {}

  public async listManageableRoomTypes(
    lodgeId: string,
    user: AuthenticatedUser,
  ): Promise<RoomType[]> {
    await this.lodgeAccessService.assertCanManageLodge(user, lodgeId);
    const roomTypes = await this.prisma.roomType.findMany({
      orderBy: { name: 'asc' },
      where: { deletedAt: null, lodgeId },
    });

    return roomTypes.map((roomType) => ({
      basePrice: roomType.basePrice.toString(),
      capacityAdults: roomType.capacityAdults,
      capacityChildren: roomType.capacityChildren,
      description: roomType.description,
      festivalPrice: roomType.festivalPrice?.toString() ?? null,
      id: roomType.id,
      isActive: roomType.isActive,
      lodgeId: roomType.lodgeId,
      name: roomType.name,
      slug: roomType.slug,
      totalRooms: roomType.totalRooms,
    }));
  }
}
