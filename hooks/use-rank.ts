"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type Metric = "balance" | "level"
type Scope = "global" | "friends"

type RankKey = `${Scope}:${Metric}`

const inFlightRequests = new Map<RankKey, { promise: Promise<number | null>; token: symbol }>()
const lastCompletedByKey = new Map<RankKey, number>()

const buildKey = (scope: Scope, metric: Metric): RankKey => `${scope}:${metric}`

async function requestRank(scope: Scope, metric: Metric, force?: boolean): Promise<number | null> {
  const key = buildKey(scope, metric)
  if (!force && inFlightRequests.has(key)) {
    return inFlightRequests.get(key)!.promise
  }

  const token = Symbol("rank-request")
  const promise = (async () => {
    try {
      const url = `/api/me/rank?scope=${scope}&metric=${metric}`
      const res = await fetch(url, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        console.error("Rank request failed:", { status: res.status, body: data })
        return null
      }

      return typeof data.rank === "number" ? data.rank : null
    } catch (error) {
      console.error("Failed to fetch rank:", error)
      return null
    } finally {
      if (inFlightRequests.get(key)?.token === token) {
        inFlightRequests.delete(key)
      }
      lastCompletedByKey.set(key, Date.now())
    }
  })()

  inFlightRequests.set(key, { promise, token })
  return promise
}

export function useRank({ scope, metric }: { scope: Scope; metric: Metric }) {
  const [rank, setRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const currentKeyRef = useRef<RankKey>(buildKey(scope, metric))
  const refreshDebounceRef = useRef<NodeJS.Timeout | null>(null)

  const runFetch = useCallback(
    async (force?: boolean) => {
      const key = buildKey(scope, metric)
      currentKeyRef.current = key
      setLoading(true)
      const result = await requestRank(scope, metric, force)
      if (currentKeyRef.current === key) {
        setRank(result)
        setLoading(false)
      }
    },
    [metric, scope],
  )

  useEffect(() => {
    void runFetch(true)
  }, [runFetch])

  useEffect(() => {
    const handleRankRefresh = () => {
      const key = buildKey(scope, metric)
      const lastCompleted = lastCompletedByKey.get(key) ?? 0
      if (Date.now() - lastCompleted < 300) return
      if (refreshDebounceRef.current) return
      refreshDebounceRef.current = setTimeout(() => {
        refreshDebounceRef.current = null
        void runFetch(true)
      }, 100)
    }

    window.addEventListener("rank:refresh", handleRankRefresh)
    return () => {
      window.removeEventListener("rank:refresh", handleRankRefresh)
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current)
      }
    }
  }, [metric, scope, runFetch])

  const refresh = useCallback(() => runFetch(true), [runFetch])

  return { rank, loading, refresh }
}
