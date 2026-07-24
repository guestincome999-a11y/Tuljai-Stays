import { Injectable } from '@nestjs/common';
import { NotificationPriority, NotificationType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationTemplatesService {
  public constructor(private readonly prisma: PrismaService) {}

  public async render(
    type: NotificationType,
    variables: Record<string, string>,
    fallback: { body: string; priority: NotificationPriority; title: string },
  ): Promise<{ body: string; priority: NotificationPriority; title: string }> {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { deletedAt: null, isActive: true, type },
    });

    if (!template) {
      return fallback;
    }

    return {
      body: this.interpolate(template.bodyTemplate, variables),
      priority: template.defaultPriority,
      title: this.interpolate(template.titleTemplate, variables),
    };
  }

  private interpolate(template: string, variables: Record<string, string>): string {
    return Object.entries(variables).reduce(
      (rendered, [key, value]) => rendered.replaceAll(`{{${key}}}`, value),
      template,
    );
  }
}
