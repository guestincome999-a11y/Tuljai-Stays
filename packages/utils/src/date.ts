export function toIsoDateTime(date: Date): string {
  return date.toISOString();
}

export function getCurrentIsoDateTime(): string {
  return toIsoDateTime(new Date());
}
