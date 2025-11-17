export type Challenge = {
  id: string
  challengerId: string
  challengerName: string
  challengedId: string
  challengedName: string
  wagerAmount: number
  durationMinutes: number
  status: "pending" | "active" | "completed" | "cancelled"
  challengerBalanceStart: number | null
  challengedBalanceStart: number | null
  challengerBalanceEnd: number | null
  challengedBalanceEnd: number | null
  challengerBalancePaused: number | null
  challengedBalancePaused: number | null
  challengerCreditBalance: number | null
  challengedCreditBalance: number | null
  challengerCreditExperience: number | null
  challengedCreditExperience: number | null
  challengerArchived: boolean | null
  challengedArchived: boolean | null
  winnerId: string | null
  startedAt: string | null
  expiresAt: string | null
  completedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  awaitingUserId: string | null
}
