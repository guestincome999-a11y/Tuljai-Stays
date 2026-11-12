import type { Prisma } from '@prisma/client';

/** All inventory writers take this room-type row lock before reading availability. */
export async function lockInventory(
  tx: Prisma.TransactionClient,
  roomTypeId: string,
): Promise<void> {
  // Shared lodge lock allows independent room types to proceed concurrently, while a
  // closure waits for in-flight allocations and prevents later ones from starting.
  await tx.$queryRaw`SELECT l.id FROM lodges l JOIN room_types r ON r.lodge_id = l.id WHERE r.id = ${roomTypeId}::uuid FOR SHARE OF l`;
  await tx.$queryRaw`SELECT id FROM room_types WHERE id = ${roomTypeId}::uuid FOR UPDATE`;
}
