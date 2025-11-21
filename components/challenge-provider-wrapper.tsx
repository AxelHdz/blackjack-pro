"use client"

import { ChallengeProvider } from "@/contexts/challenge-context"
import { BlackjackGame } from "@/components/blackjack-game"

interface ChallengeProviderWrapperProps {
  userId: string
  friendReferralId?: string
}

export function ChallengeProviderWrapper({ userId, friendReferralId }: ChallengeProviderWrapperProps) {
  return (
    <ChallengeProvider userId={userId}>
      <BlackjackGame userId={userId} friendReferralId={friendReferralId} />
    </ChallengeProvider>
  )
}

