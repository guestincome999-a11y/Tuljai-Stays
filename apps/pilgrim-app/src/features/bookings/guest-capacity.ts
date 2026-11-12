export function guestCapacityError(
  adults: number,
  children: number,
  maxAdults: number,
  maxChildren: number,
): string | null {
  return adults > maxAdults || children > maxChildren
    ? `Maximum ${maxAdults} adults and ${maxChildren} children allowed for this room.`
    : null;
}
