/** Serializes native writes. A slow earlier write cannot leave the icon stale.
 * Dismiss only known read IDs, never the entire tray (a new push can arrive
 * between fetching the snapshot and writing the badge).
 */
export function createNotificationBadgeWriter(
  write: (count: number, readIds: string[]) => Promise<void>,
) {
  let latest = { count: 0, readIds: [] as string[] };
  let revision = 0;
  let written = -1;
  let successfulKey: string | null = null;
  let worker: Promise<void> | null = null;
  function sync(count: number, readIds: string[] = []): Promise<void> {
    const key = JSON.stringify([count, readIds]);
    if (!worker && key === successfulKey) return Promise.resolve();
    latest = { count, readIds };
    revision++;
    if (!worker) {
      worker = (async () => {
        while (written !== revision) {
          written = revision;
          const target = latest;
          await write(target.count, target.readIds);
          successfulKey = JSON.stringify([target.count, target.readIds]);
        }
      })().finally(() => {
        worker = null;
        if (written !== revision) return sync(latest.count, latest.readIds);
      });
    }
    return worker;
  }
  return sync;
}
