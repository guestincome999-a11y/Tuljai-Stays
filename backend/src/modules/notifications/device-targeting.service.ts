import { Injectable } from '@nestjs/common';

import { AppType, type DeviceToken } from '../../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeviceTargetingService {
  public constructor(private readonly prisma: PrismaService) {}

  public async getActiveUserDevices(userId: string, appType?: AppType): Promise<DeviceToken[]> {
    return this.prisma.deviceToken.findMany({
      where: {
        ...(appType ? { appType } : {}),
        isActive: true,
        userId,
      },
    });
  }

  public async deactivateToken(id: string): Promise<void> {
    await this.prisma.deviceToken.update({
      data: { isActive: false },
      where: { id },
    });
  }
}
