"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react"
import { type Challenge } from "@/types/challenge"
import { fetchCached } from "@/lib/fetch-cache"

interface ChallengeContextType {
  activeChallenge: Challenge | null
  isLoading: boolean
  refreshActiveChallenge: () => Promise<void>
  setActiveChallenge: (challenge: Challenge | null) => void
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined)

interface ChallengeProviderProps {
  children: ReactNode
  userId: string
}

export function ChallengeProvider({ children, userId }: ChallengeProviderProps) {
  const [activeChallenge, setActiveChallengeState] = useState<Challenge | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const activeChallengeRef = useRef<Challenge | null>(null)
  const isInitialMountRef = useRef(true)

  // Keep ref in sync with state
  useEffect(() => {
    activeChallengeRef.current = activeChallenge
  }, [activeChallenge])

  const fetchActiveChallenge = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await fetchCached<{ challenge?: Challenge }>("/api/challenges/active", undefined, 10000) // 10s TTL
      if (data.challenge && data.challenge.status === "active") {
        setActiveChallengeState(data.challenge)
        // Emit event for components that listen to it
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("challenge:progress", { detail: data.challenge }))
        }
      } else {
        setActiveChallengeState(null)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch active challenge:", error)
      setActiveChallengeState(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshActiveChallenge = useCallback(async () => {
    await fetchActiveChallenge()
  }, [fetchActiveChallenge])

  const setActiveChallenge = useCallback((challenge: Challenge | null) => {
    setActiveChallengeState(challenge)
    if (challenge && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("challenge:progress", { detail: challenge }))
    }
  }, [])

  // Initial fetch on mount
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      void fetchActiveChallenge()
    }
  }, [fetchActiveChallenge])

  // Listen to challenge:progress events from other sources
  useEffect(() => {
    const handleChallengeProgress = (event: Event) => {
      const detail = (event as CustomEvent<Challenge | null>).detail
      if (detail && detail.status === "active") {
        setActiveChallengeState(detail)
      } else if (!detail) {
        setActiveChallengeState(null)
      }
    }

    window.addEventListener("challenge:progress", handleChallengeProgress as EventListener)
    return () => window.removeEventListener("challenge:progress", handleChallengeProgress as EventListener)
  }, [])

  // Consolidated visibility change handler - only fetch if no active challenge
  useEffect(() => {
    let isInitialMount = true

    const handleVisibilityChange = () => {
      if (isInitialMount) {
        isInitialMount = false
        return
      }

      if (document.visibilityState === "visible" && !activeChallengeRef.current) {
        void fetchActiveChallenge()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [fetchActiveChallenge])

  return (
    <ChallengeContext.Provider
      value={{
        activeChallenge,
        isLoading,
        refreshActiveChallenge,
        setActiveChallenge,
      }}
    >
      {children}
    </ChallengeContext.Provider>
  )
}

export function useChallenge() {
  const context = useContext(ChallengeContext)
  if (context === undefined) {
    throw new Error("useChallenge must be used within a ChallengeProvider")
  }
  return context
}
