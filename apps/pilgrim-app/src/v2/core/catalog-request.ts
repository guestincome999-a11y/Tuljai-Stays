export function catalogErrorKind(error: unknown): 'network' | 'server' | 'request' {
  const status = (error as { details?: { statusCode?: number } })?.details?.statusCode;
  return status === undefined ? 'network' : status >= 500 ? 'server' : 'request';
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Catalog request cancelled');
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    checkAbort(signal);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new Error('Catalog request cancelled'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

/** Retry only idempotent discovery reads, never booking or payment writes. */
export async function readCatalog<T>(read: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const delays = [1500, 4000];
  for (let attempt = 0; ; attempt += 1) {
    checkAbort(signal);
    try {
      const result = await read();
      checkAbort(signal);
      return result;
    } catch (error) {
      checkAbort(signal);
      const delay = delays[attempt];
      if (delay === undefined || catalogErrorKind(error) === 'request') throw error;
      await pause(delay, signal);
    }
  }
}
