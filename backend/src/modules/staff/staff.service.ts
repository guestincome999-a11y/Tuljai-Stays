import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { AssignStaffRoleDto } from './dto/staff.dto';

@Injectable()
export class StaffService {
  public constructor(private readonly prisma: PrismaService) {}
  public async getCurrentRole(userId: string): Promise<{ role: string | null }> {
    const rows = await this.prisma.$queryRaw<Array<{ role: string }>>(
      Prisma.sql`SELECT "role" FROM "staff_role_assignments" WHERE "user_id" = ${userId}::uuid LIMIT 1`,
    );
    return { role: rows[0]?.role ?? null };
  }
  public async list() {
    return this.prisma.$queryRaw<
      Array<{
        user_id: string;
        display_name: string | null;
        phone_number: string | null;
        base_roles: string[];
        staff_role: string | null;
        updated_at: Date | null;
      }>
    >(
      Prisma.sql`SELECT u."id" AS user_id, u."display_name", u."phone_number", ARRAY(SELECT jsonb_array_elements_text(to_jsonb(u."roles"))) AS base_roles, s."role" AS staff_role, s."updated_at" FROM "users" u LEFT JOIN "staff_role_assignments" s ON s."user_id" = u."id" WHERE u."deleted_at" IS NULL AND (u."roles" && ARRAY['ADMIN','SUPER_ADMIN']::"UserRole"[] OR s."user_id" IS NOT NULL) ORDER BY u."display_name" NULLS LAST, u."created_at" ASC`,
    );
  }
  public async assign(userId: string, dto: AssignStaffRoleDto, actorUserId: string) {
    const user = await this.prisma.user.findFirst({
      select: { id: true, roles: true, isActive: true, deletedAt: true },
      where: { id: userId },
    });
    if (!user || user.deletedAt || !user.isActive)
      throw new NotFoundException('Staff account not found');
    if (!user.roles.includes('ADMIN') && !user.roles.includes('SUPER_ADMIN'))
      throw new BadRequestException('Staff sub-roles can only be assigned to an admin account');
    if (!dto.role) {
      await this.prisma
        .$executeRaw`DELETE FROM "staff_role_assignments" WHERE "user_id" = ${userId}::uuid`;
      return { userId, role: null };
    }
    await this.prisma.$executeRaw(
      Prisma.sql`INSERT INTO "staff_role_assignments" ("user_id", "role", "assigned_by_user_id", "created_at", "updated_at") VALUES (${userId}::uuid, ${dto.role}, ${actorUserId}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("user_id") DO UPDATE SET "role" = EXCLUDED."role", "assigned_by_user_id" = EXCLUDED."assigned_by_user_id", "updated_at" = CURRENT_TIMESTAMP`,
    );
    return { userId, role: dto.role };
  }
}
