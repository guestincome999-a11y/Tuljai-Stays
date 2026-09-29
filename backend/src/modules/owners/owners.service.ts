import { ConflictException, Injectable } from '@nestjs/common';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

import type { AssignLodgeOwnerDto, CreateTeamMemberDto, UpdateTeamMemberDto } from './dto/owner.dto';

export interface TeamMember {
  id: string;
  isActive: boolean;
  isPrimary: boolean;
  memberType: 'OWNER' | 'STAFF';
  roleTitle: string | null;
  user: {
    displayName: string | null;
    email: string | null;
    id: string;
    isActive: boolean;
    phoneNumber: string | null;
  };
}

@Injectable()
export class OwnersService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  public async assignOwner(
    lodgeId: string,
    dto: AssignLodgeOwnerDto,
    actorUserId: string,
  ): Promise<{ success: true }> {
    await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.lodgeOwner.updateMany({
          data: { isPrimary: false },
          where: { lodgeId },
        });
        await tx.lodge.update({
          data: { ownerUserId: dto.userId },
          where: { id: lodgeId },
        });
      }

      const user = await tx.user.findUniqueOrThrow({ where: { id: dto.userId } });

      if (!user.roles.includes('OWNER')) {
        await tx.user.update({
          data: {
            roles: {
              push: 'OWNER',
            },
          },
          where: { id: dto.userId },
        });
      }

      await tx.lodgeOwner.upsert({
        create: {
          isPrimary: dto.isPrimary ?? false,
          lodgeId,
          ownerEmail: dto.ownerEmail,
          ownerName: dto.ownerName,
          ownerPhone: dto.ownerPhone,
          roleTitle: dto.roleTitle,
          userId: dto.userId,
        },
        update: {
          isActive: true,
          isPrimary: dto.isPrimary ?? false,
          ownerEmail: dto.ownerEmail,
          ownerName: dto.ownerName,
          ownerPhone: dto.ownerPhone,
          roleTitle: dto.roleTitle,
        },
        where: {
          lodgeId_userId: {
            lodgeId,
            userId: dto.userId,
          },
        },
      });
    });

    await this.auditLogService.create({
      action: 'LODGE_OWNER_ASSIGNED',
      actorUserId,
      entityId: lodgeId,
      entityType: 'lodge',
      metadata: { ownerUserId: dto.userId },
    });

    return { success: true };
  }

  public async listTeam(lodgeId: string): Promise<TeamMember[]> {
    const rows = await this.prisma.lodgeOwner.findMany({
      include: { user: true },
      orderBy: [{ memberType: 'asc' }, { isPrimary: 'desc' }, { createdAt: 'asc' }],
      where: { deletedAt: null, lodgeId },
    });

    return rows.map((row) => ({
      id: row.id,
      isActive: row.isActive,
      isPrimary: row.isPrimary,
      memberType: row.memberType,
      roleTitle: row.roleTitle,
      user: {
        displayName: row.user.displayName,
        email: row.user.email,
        id: row.user.id,
        isActive: row.user.isActive,
        phoneNumber: row.user.phoneNumber,
      },
    }));
  }

  /**
   * Creates a brand-new user account (owner or staff) with an admin-chosen
   * initial password, and attaches them to the lodge. Unlike assignOwner,
   * this doesn't require a pre-existing userId - it's the primary way an
   * admin onboards a lodge owner or adds lodge staff from scratch.
   */
  public async createTeamMember(
    lodgeId: string,
    dto: CreateTeamMemberDto,
    actorUserId: string,
  ): Promise<TeamMember> {
    const email = dto.email.trim().toLowerCase();
    const [emailConflict, phoneConflict] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.user.findUnique({ where: { phoneNumber: dto.phoneNumber } }),
    ]);
    if (emailConflict)
      throw new ConflictException(
        'A user with this email already exists. Use "assign existing owner" instead.',
      );
    if (phoneConflict)
      throw new ConflictException(
        'A user with this phone number already exists. Use "assign existing owner" instead.',
      );

    const role = dto.memberType === 'STAFF' ? 'STAFF' : 'OWNER';
    const row = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          displayName: dto.name,
          email,
          phoneNumber: dto.phoneNumber,
          roles: [role],
        },
      });

      if (dto.isPrimary) {
        await tx.lodgeOwner.updateMany({ data: { isPrimary: false }, where: { lodgeId } });
        if (dto.memberType === 'OWNER') {
          await tx.lodge.update({ data: { ownerUserId: user.id }, where: { id: lodgeId } });
        }
      }

      return tx.lodgeOwner.create({
        data: {
          isPrimary: dto.isPrimary ?? false,
          lodgeId,
          memberType: dto.memberType,
          ownerEmail: email,
          ownerName: dto.name,
          ownerPhone: dto.phoneNumber,
          roleTitle: dto.roleTitle,
          userId: user.id,
        },
        include: { user: true },
      });
    });

    // Reuses AuthService's password-hashing/AuthIdentity logic rather than
    // duplicating it here.
    await this.authService.adminSetPassword(row.userId, dto.password);

    await this.auditLogService.create({
      action: dto.memberType === 'STAFF' ? 'LODGE_STAFF_CREATED' : 'LODGE_OWNER_CREATED',
      actorUserId,
      entityId: lodgeId,
      entityType: 'lodge',
      metadata: { memberType: dto.memberType, newUserId: row.userId },
    });

    return {
      id: row.id,
      isActive: row.isActive,
      isPrimary: row.isPrimary,
      memberType: row.memberType,
      roleTitle: row.roleTitle,
      user: {
        displayName: row.user.displayName,
        email: row.user.email,
        id: row.user.id,
        isActive: row.user.isActive,
        phoneNumber: row.user.phoneNumber,
      },
    };
  }

  public async updateTeamMember(
    lodgeId: string,
    membershipId: string,
    dto: UpdateTeamMemberDto,
    actorUserId: string,
  ): Promise<TeamMember> {
    const existing = await this.prisma.lodgeOwner.findFirstOrThrow({
      where: { deletedAt: null, id: membershipId, lodgeId },
    });

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.lodgeOwner.updateMany({ data: { isPrimary: false }, where: { lodgeId } });
        if (existing.memberType === 'OWNER') {
          await tx.lodge.update({
            data: { ownerUserId: existing.userId },
            where: { id: lodgeId },
          });
        }
      }

      return tx.lodgeOwner.update({
        data: {
          isActive: dto.isActive ?? existing.isActive,
          isPrimary: dto.isPrimary ?? existing.isPrimary,
          roleTitle: dto.roleTitle ?? existing.roleTitle,
        },
        include: { user: true },
        where: { id: membershipId },
      });
    });

    await this.auditLogService.create({
      action: 'LODGE_TEAM_MEMBER_UPDATED',
      actorUserId,
      entityId: membershipId,
      entityType: 'lodge_owner',
      metadata: { lodgeId },
    });

    return {
      id: row.id,
      isActive: row.isActive,
      isPrimary: row.isPrimary,
      memberType: row.memberType,
      roleTitle: row.roleTitle,
      user: {
        displayName: row.user.displayName,
        email: row.user.email,
        id: row.user.id,
        isActive: row.user.isActive,
        phoneNumber: row.user.phoneNumber,
      },
    };
  }
}
