import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET: Get user's active challenge
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
    const { data: challenge, error } = await supabase
      .from("challenges")
      .select("*")
      .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
      .eq("status", "active")
      .maybeSingle()

    if (error) {
      console.error("[v0] Active challenge fetch error:", error)
      return NextResponse.json({ error: "Failed to fetch active challenge" }, { status: 500 })
    }

    if (!challenge) {
      return NextResponse.json({ challenge: null })
    }

    // Fetch user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", [challenge.challenger_id, challenge.challenged_id])

    if (profilesError) {
      console.error("[v0] User profiles fetch error:", profilesError)
    }

    const profilesMap = new Map(profiles?.map((profile) => [profile.id, profile]) || [])

    const challengerProfile = profilesMap.get(challenge.challenger_id)
    const challengedProfile = profilesMap.get(challenge.challenged_id)

    return NextResponse.json({
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
      winnerId: challenge.winner_id,
      startedAt: challenge.started_at,
      expiresAt: challenge.expires_at,
      completedAt: challenge.completed_at,
      createdAt: challenge.created_at,
      updatedAt: challenge.updated_at,
    })
  } catch (err) {
    console.error("[v0] Active challenge error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

