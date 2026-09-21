// ── Tiny in-memory TTL cache for idempotent GET lookups ──────────────────────
// Used for reference reads (product detail, unit lists, inventory-product
// lists) so repeated pickers and modal loads don't re-hit the server while
// a user is on a screen. Mutations call invalidateCachePrefix so the next
// read re-fetches fresh data (ad-hoc query invalidation — there is no
// React Query in this app).

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();
const DEFAULT_TTL = 10_000;

/** Resolve a cached GET read, falling back to `loader` on miss/expiry. */
export function cacheRead<T>(
  key: string,
  loader: () => Promise<T>,
  ttl = DEFAULT_TTL,
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return Promise.resolve(hit.value as T);
  }
  return loader().then((value) => {
    store.set(key, { value, expiresAt: Date.now() + ttl });
    return value;
  });
}

/** Drop one cache key (future reads re-fetch). */
export function invalidateCache(key: string): void {
  store.delete(key);
}

/** Drop every cache key with the given prefix. */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}