import { performance } from 'node:perf_hooks';

// Public read-only sampling, no auth tokens and no booking/payment writes.
const base = process.env.CATALOG_BENCHMARK_URL;
if (!base) throw new Error('Set CATALOG_BENCHMARK_URL to an explicitly chosen API base URL');
const results = [];
for (const query of ['', 'maxPrice=1200', 'minPrice=500&maxPrice=1200', 'maxPrice=0']) {
  const url = new URL(`${base.replace(/\/$/, '')}/catalog/lodges`);
  url.search = `page=1&pageSize=12${query ? `&${query}` : ''}`;
  const started = performance.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  const body = await response.text();
  const elapsedMs = Math.round(performance.now() - started);
  const parsed = JSON.parse(body);
  const data = parsed.data ?? parsed;
  results.push({
    query,
    status: response.status,
    elapsedMs,
    bytes: Buffer.byteLength(body),
    totalItems: data.totalItems,
  });
}
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), results }, null, 2));
