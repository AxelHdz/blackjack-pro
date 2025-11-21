type CacheEntry<T> = {
  expiresAt: number
  staleAt: number // Time when entry becomes stale but can still be used
  promise: Promise<T>
  data?: T // Cached data for stale-while-revalidate
}

const cache = new Map<string, CacheEntry<unknown>>()

// Optimized TTL values for better cache hit rates while maintaining responsiveness
// Increased from 3s to 5s for better deduplication of rapid successive calls
const DEFAULT_TTL_MS = 5000
// Increased stale window from 10s to 15s to allow longer stale-while-revalidate periods
const DEFAULT_STALE_TTL_MS = 15000 // Stale-while-revalidate window: 15s after expiry

/**
 * Lightweight in-memory fetch cache for GET requests to dedupe bursts of identical calls.
 * Implements stale-while-revalidate pattern for better performance.
 */
export async function fetchCached<T = unknown>(
  url: string,
  options?: RequestInit,
  ttlMs: number = DEFAULT_TTL_MS,
  staleTtlMs: number = DEFAULT_STALE_TTL_MS,
): Promise<T> {
  // Only cache GET requests
  const method = options?.method?.toUpperCase() || "GET"
  if (method !== "GET") {
    const res = await fetch(url, options)
    if (!res.ok) throw new Error(`Request failed: ${res.status}`)
    return res.json() as Promise<T>
  }

  const now = Date.now()
  const existing = cache.get(url) as CacheEntry<T> | undefined

  // If entry is fresh, return cached promise
  if (existing && existing.expiresAt > now) {
    return existing.promise as Promise<T>
  }

  // If entry is stale but within stale window, return cached data and revalidate in background
  if (existing && existing.staleAt > now && existing.data !== undefined) {
    // Trigger background revalidation (don't await)
    fetch(url, options)
      .then((res) => {
        if (res.ok) {
          return res.json() as Promise<T>
        }
        return existing.data!
      })
      .then((data) => {
        const entry = cache.get(url) as CacheEntry<T> | undefined
        if (entry) {
          entry.data = data
          entry.expiresAt = Date.now() + ttlMs
          entry.staleAt = Date.now() + ttlMs + staleTtlMs
        }
      })
      .catch(() => {
        // Ignore revalidation errors, keep using stale data
      })
    return Promise.resolve(existing.data)
  }

  // Entry expired or doesn't exist - fetch fresh data
  const promise = fetch(url, options)
    .then((res) => {
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      return res.json() as Promise<T>
    })
    .then((data) => {
      // Store data in cache entry
      const entry = cache.get(url) as CacheEntry<T> | undefined
      if (entry) {
        entry.data = data
      }
      return data
    })
    .catch((err) => {
      // Bust cache on failure so the next attempt can retry immediately
      if (cache.get(url)?.promise === promise) {
        cache.delete(url)
      }
      throw err
    })

  cache.set(url, {
    promise,
    expiresAt: now + ttlMs,
    staleAt: now + ttlMs + staleTtlMs,
  } as CacheEntry<T>)
  return promise
}

export function bustFetchCache(url?: string) {
  if (url) {
    cache.delete(url)
  } else {
    cache.clear()
  }
}
