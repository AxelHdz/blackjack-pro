type CacheEntry<T> = {
  expiresAt: number
  promise: Promise<T>
}

const cache = new Map<string, CacheEntry<unknown>>()

const DEFAULT_TTL_MS = 3000

/**
 * Lightweight in-memory fetch cache for GET requests to dedupe bursts of identical calls.
 */
export async function fetchCached<T = unknown>(
  url: string,
  options?: RequestInit,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  // Only cache GET requests
  const method = options?.method?.toUpperCase() || "GET"
  if (method !== "GET") {
    const res = await fetch(url, options)
    if (!res.ok) throw new Error(`Request failed: ${res.status}`)
    return res.json() as Promise<T>
  }

  const now = Date.now()
  const existing = cache.get(url)
  if (existing && existing.expiresAt > now) {
    return existing.promise as Promise<T>
  }

  const promise = fetch(url, options)
    .then((res) => {
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      return res.json() as Promise<T>
    })
    .catch((err) => {
      // Bust cache on failure so the next attempt can retry immediately
      if (cache.get(url)?.promise === promise) {
        cache.delete(url)
      }
      throw err
    })

  cache.set(url, { promise, expiresAt: now + ttlMs })
  return promise
}

export function bustFetchCache(url?: string) {
  if (url) {
    cache.delete(url)
  } else {
    cache.clear()
  }
}
