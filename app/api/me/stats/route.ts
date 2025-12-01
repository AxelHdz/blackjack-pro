import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createDeck, type Card as CardType } from "@/lib/card-utils"

type LearningMode = "guided" | "practice" | "expert"

type ModeStatsPayload = {
  handsPlayed?: number
  correctMoves?: number
  totalMoves?: number
  wins?: number
  losses?: number
}

type ModeStats = Partial<Record<LearningMode, ModeStatsPayload>>

type StatsPayload = {
  balance?: number
  totalWinnings?: number
  levelWinnings?: number
  level?: number
  xp?: number
  handsPlayed?: number
  correctMoves?: number
  totalMoves?: number
  wins?: number
  losses?: number
  drillTier?: number
  lastDrillCompletedAt?: string | null
  modeStats?: ModeStats
  learningMode?: LearningMode
  deck?: CardType[]
  activeChallenge?: boolean
}

const buildDefaultStats = (userId: string, deck: CardType[]) => ({
  user_id: userId,
  total_money: 500,
  total_winnings: 0,
  level: 1,
  experience: 0,
  hands_played: 0,
  correct_moves: 0,
  total_moves: 0,
  wins: 0,
  losses: 0,
  drill_tier: 0,
  last_drill_completed_at: null,
  last_play_mode: "guided",
  learning_hands_played: 0,
  learning_correct_moves: 0,
  learning_total_moves: 0,
  learning_wins: 0,
  learning_losses: 0,
  practice_hands_played: 0,
  practice_correct_moves: 0,
  practice_total_moves: 0,
  practice_wins: 0,
  practice_losses: 0,
  expert_hands_played: 0,
  expert_correct_moves: 0,
  expert_total_moves: 0,
  expert_wins: 0,
  expert_losses: 0,
  deck,
})

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data, error } = await supabase.from("game_stats").select("*").eq("user_id", user.id).maybeSingle()

    if (error && error.code !== "PGRST116") {
      console.error("Failed to load stats:", error)
      return NextResponse.json({ error: "Failed to load stats" }, { status: 500 })
    }

    if (!data) {
      const deck = createDeck()
      const defaults = buildDefaultStats(user.id, deck)
      const { data: inserted, error: insertError } = await supabase
        .from("game_stats")
        .insert(defaults)
        .select("*")
        .single()

      if (insertError || !inserted) {
        console.error("Failed to create default stats:", insertError)
        return NextResponse.json({ error: "Failed to create stats" }, { status: 500 })
      }

      return NextResponse.json({ stats: inserted })
    }

    return NextResponse.json({ stats: data })
  } catch (err) {
    console.error("Stats GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as StatsPayload
    const {
      balance,
      totalWinnings,
      levelWinnings,
      level,
      xp,
      handsPlayed,
      correctMoves,
      totalMoves,
      wins,
      losses,
      drillTier,
      lastDrillCompletedAt,
      modeStats,
      learningMode,
      deck,
      activeChallenge,
    } = body

    const moneyFields =
      activeChallenge === true
        ? {}
        : {
            total_money: Number.isFinite(balance) ? Math.floor(balance!) : undefined,
            total_winnings: Number.isFinite(totalWinnings) ? Math.floor(totalWinnings!) : undefined,
            level_winnings: Number.isFinite(levelWinnings) ? Math.floor(levelWinnings!) : undefined,
          }

    const updates: Record<string, unknown> = {
      level: Number.isFinite(level) ? Math.floor(level!) : undefined,
      experience: Number.isFinite(xp) ? Math.floor(xp!) : undefined,
      hands_played: Number.isFinite(handsPlayed) ? Math.floor(handsPlayed!) : undefined,
      correct_moves: Number.isFinite(correctMoves) ? Math.floor(correctMoves!) : undefined,
      total_moves: Number.isFinite(totalMoves) ? Math.floor(totalMoves!) : undefined,
      wins: Number.isFinite(wins) ? Math.floor(wins!) : undefined,
      losses: Number.isFinite(losses) ? Math.floor(losses!) : undefined,
      drill_tier: Number.isFinite(drillTier) ? Math.floor(drillTier!) : undefined,
      last_drill_completed_at: lastDrillCompletedAt ? new Date(lastDrillCompletedAt).toISOString() : null,
      last_play_mode: learningMode ?? undefined,
      updated_at: new Date().toISOString(),
      ...moneyFields,
    }

    if (modeStats) {
      const applyMode = (prefix: string, mode?: ModeStatsPayload) => {
        if (!mode) return
        const setIfNumber = (field: string, value: number | null | undefined) => {
          if (typeof value === "number" && Number.isFinite(value)) {
            updates[field] = Math.floor(value)
          }
        }
        setIfNumber(`${prefix}_hands_played`, mode.handsPlayed)
        setIfNumber(`${prefix}_correct_moves`, mode.correctMoves)
        setIfNumber(`${prefix}_total_moves`, mode.totalMoves)
        setIfNumber(`${prefix}_wins`, mode.wins)
        setIfNumber(`${prefix}_losses`, mode.losses)
      }

      applyMode("learning", modeStats.guided)
      applyMode("practice", modeStats.practice)
      applyMode("expert", modeStats.expert)
    }

    if (deck && Array.isArray(deck) && deck.length > 0) {
      updates.deck = deck
    }

    Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key])

    const { error } = await supabase.from("game_stats").update(updates).eq("user_id", user.id)

    if (error) {
      console.error("Failed to save stats:", error)
      return NextResponse.json({ error: "Failed to save stats" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Stats POST error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
