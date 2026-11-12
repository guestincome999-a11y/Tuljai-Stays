import type { Prisma } from '@prisma/client';

/** All inventory writers take this room-type row lock before reading availability. */
export async function lockInventory(
  tx: Prisma.TransactionClient,
  roomTypeId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM room_types WHERE id = ${roomTypeId}::uuid FOR UPDATE`;
}
