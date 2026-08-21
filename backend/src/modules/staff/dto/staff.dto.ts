import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export const STAFF_ROLE_VALUES = [
  'FINANCE_ADMIN',
  'OPERATIONS_MANAGER',
  'SUPPORT_EXECUTIVE',
  'PHOTO_REVIEWER',
  'ANALYST',
] as const;

export class AssignStaffRoleDto {
  @IsOptional()
  @IsString()
  @IsIn(STAFF_ROLE_VALUES)
  role?: (typeof STAFF_ROLE_VALUES)[number] | null;
}

export class StaffUserParamDto {
  @IsUUID()
  userId!: string;
}
