import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LodgeAccessService {
  public constructor(private readonly prisma: PrismaService) {}

  public isAdmin(user: AuthenticatedUser): boolean {
    return user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN');
  }

  public async assertCanManageLodge(user: AuthenticatedUser, lodgeId: string): Promise<void> {
    if (this.isAdmin(user)) {
      return;
    }

    if (!user.roles.includes('OWNER')) {
      throw new ForbiddenException('Owner access is required');
    }

    const assignment = await this.prisma.lodgeOwner.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        lodgeId,
        userId: user.id,
      },
    });

    if (!assignment) {
      throw new ForbiddenException('You can manage only assigned lodges');
    }
  }

  public async assertLodgeExists(lodgeId: string): Promise<void> {
    const lodge = await this.prisma.lodge.findFirst({
      where: { deletedAt: null, id: lodgeId },
    });

    if (!lodge) {
      throw new NotFoundException('Lodge not found');
    }
  }
}
