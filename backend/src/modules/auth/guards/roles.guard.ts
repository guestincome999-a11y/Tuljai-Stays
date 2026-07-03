import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser, UserRole } from '@tuljai/types';

import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      return false;
    }

    if (user.roles.includes('SUPER_ADMIN')) {
      return true;
    }

    return user.roles.some((role) => requiredRoles.includes(role));
  }
}
