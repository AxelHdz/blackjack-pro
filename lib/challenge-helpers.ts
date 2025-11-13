export type ChallengeRecord = {
  id: string
  challenger_id: string
  challenged_id: string
  wager_amount: number
  duration_minutes: number
  status: string
  challenger_balance_start: number | null
  challenged_balance_start: number | null
  challenger_balance_end: number | null
  challenged_balance_end: number | null
  challenger_balance_paused: number | null
  challenged_balance_paused: number | null
  challenger_credit_balance: number | null
  challenged_credit_balance: number | null
  challenger_credit_experience: number | null
  challenged_credit_experience: number | null
  winner_id: string | null
  started_at: string | null
  expires_at: string | null
  completed_at: string | null
  created_at: string | null
  updated_at: string | null
}

const getTimestamp = (value: string | null) => (value ? new Date(value).getTime() : null)

export const deriveAwaitingUserId = (challenge: ChallengeRecord): string | null => {
  if (challenge.status !== "pending") {
    return null
  }

  const created = getTimestamp(challenge.created_at)
  const updated = getTimestamp(challenge.updated_at)

  if (!created || !updated || updated === created) {
    return challenge.challenged_id
  }

  return updated > created ? challenge.challenger_id : challenge.challenged_id
}

type ProfileMap = Map<string, { display_name?: string | null }>

export const formatChallengeResponse = (
  challenge: ChallengeRecord,
  profilesMap: ProfileMap,
) => {
  const challengerProfile = profilesMap.get(challenge.challenger_id)
  const challengedProfile = profilesMap.get(challenge.challenged_id)

  return {
    id: challenge.id,
    challengerId: challenge.challenger_id,
    challengerName: challengerProfile?.display_name || `User ${challenge.challenger_id.slice(0, 8)}`,
    challengedId: challenge.challenged_id,
    challengedName: challengedProfile?.display_name || `User ${challenge.challenged_id.slice(0, 8)}`,
    wagerAmount: challenge.wager_amount,
    durationMinutes: challenge.duration_minutes,
    status: challenge.status,
    challengerBalanceStart: challenge.challenger_balance_start,
    challengedBalanceStart: challenge.challenged_balance_start,
    challengerBalanceEnd: challenge.challenger_balance_end,
    challengedBalanceEnd: challenge.challenged_balance_end,
    challengerBalancePaused: challenge.challenger_balance_paused,
    challengedBalancePaused: challenge.challenged_balance_paused,
    challengerCreditBalance: challenge.challenger_credit_balance,
    challengedCreditBalance: challenge.challenged_credit_balance,
    challengerCreditExperience: challenge.challenger_credit_experience,
    challengedCreditExperience: challenge.challenged_credit_experience,
    winnerId: challenge.winner_id,
    startedAt: challenge.started_at,
    expiresAt: challenge.expires_at,
    completedAt: challenge.completed_at,
    createdAt: challenge.created_at,
    updatedAt: challenge.updated_at,
    awaitingUserId: deriveAwaitingUserId(challenge),
  }
}
