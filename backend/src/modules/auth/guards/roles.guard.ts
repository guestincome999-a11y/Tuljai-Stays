import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '@tuljai/types';

import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY, STAFF_ROLES, type AccessRole } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AccessRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return false;
    if (user.roles.includes('SUPER_ADMIN')) return true;
    if (user.roles.some((role) => requiredRoles.includes(role))) return true;

    const needsStaffLookup = requiredRoles.some((role) =>
      (STAFF_ROLES as readonly string[]).includes(role),
    );
    if (!needsStaffLookup) return false;

    const assignment = await this.prisma.$queryRaw<Array<{ role: string }>>`
      SELECT "role"
      FROM "staff_role_assignments"
      WHERE "user_id" = ${user.id}::uuid
      LIMIT 1
    `;

    const assignedRole = assignment[0]?.role;
    return assignedRole !== undefined && requiredRoles.includes(assignedRole as AccessRole);
  }
}
