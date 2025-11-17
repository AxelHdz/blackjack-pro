import { createClient } from "@/lib/supabase/server"
import { formatChallengeResponse, type ChallengeRecord } from "@/lib/challenge-helpers"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const statusFilter = searchParams.get("status") // 'pending' | 'active' | 'pending,active' | null (all)

    let query = supabase
      .from("challenges")
      .select("*")
      .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)

    if (statusFilter) {
      if (statusFilter.includes(",")) {
        // Multiple statuses
        const statuses = statusFilter
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
        if (statuses.length > 0) {
          query = query.in("status", statuses)
        }
      } else {
        query = query.eq("status", statusFilter)
      }
    }

    query = query.order("created_at", { ascending: false })

    const { data: challenges, error } = await query

    if (error) {
      console.error("[v0] Challenges fetch error:", error)
      return NextResponse.json({ error: "Failed to fetch challenges" }, { status: 500 })
    }

    const userIds = new Set<string>()
    challenges?.forEach((challenge) => {
      userIds.add(challenge.challenger_id)
      userIds.add(challenge.challenged_id)
    })

    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", Array.from(userIds))

    if (profilesError) {
      console.error("[v0] User profiles fetch error:", profilesError)
    }

    const profilesMap = new Map(profiles?.map((profile) => [profile.id, profile]) || [])

    const formattedChallenges =
      challenges?.map((challenge) => formatChallengeResponse(challenge as ChallengeRecord, profilesMap)) || []

    return NextResponse.json({ challenges: formattedChallenges })
  } catch (err) {
    console.error("[v0] Challenges error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { challengedId, wagerAmount, durationMinutes } = body

    if (!challengedId || !wagerAmount || !durationMinutes) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (challengedId === user.id) {
      return NextResponse.json({ error: "Cannot challenge yourself" }, { status: 400 })
    }

    if (![5, 10].includes(durationMinutes)) {
      return NextResponse.json({ error: "Duration must be 5 or 10 minutes" }, { status: 400 })
    }

    if (wagerAmount <= 0) {
      return NextResponse.json({ error: "Wager amount must be positive" }, { status: 400 })
    }

    // Check if challenger has sufficient balance
    const { data: challengerStats, error: statsError } = await supabase
      .from("game_stats")
      .select("total_money")
      .eq("user_id", user.id)
      .single()

    if (statsError || !challengerStats) {
      console.error("[v0] Failed to fetch challenger stats:", statsError)
      return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 })
    }

    if (challengerStats.total_money < wagerAmount) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
    }

    // Check if challenged user has sufficient balance
    const { data: challengedStats, error: challengedStatsError } = await supabase
      .from("game_stats")
      .select("total_money")
      .eq("user_id", challengedId)
      .single()

    if (challengedStatsError || !challengedStats) {
      console.error("[v0] Failed to fetch challenged user stats:", challengedStatsError)
      return NextResponse.json({ error: "Failed to fetch challenged user balance" }, { status: 500 })
    }

    if (challengedStats.total_money < wagerAmount) {
      return NextResponse.json({ 
        error: `Wager cannot exceed challenged user's balance of $${challengedStats.total_money.toLocaleString()}` 
      }, { status: 400 })
    }

    // Check if challenger already has an active/pending challenge
    const { data: existingChallenge, error: existingError } = await supabase
      .from("challenges")
      .select("id")
      .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
      .in("status", ["pending", "active"])
      .maybeSingle()

    if (existingError) {
      console.error("[v0] Error checking existing challenges:", existingError)
      return NextResponse.json({ error: "Failed to check existing challenges" }, { status: 500 })
    }

    if (existingChallenge) {
      return NextResponse.json({ error: "You already have an active or pending challenge" }, { status: 400 })
    }

    // Check if challenged user already has an active/pending challenge
    const { data: challengedExisting, error: challengedExistingError } = await supabase
      .from("challenges")
      .select("id")
      .or(`challenger_id.eq.${challengedId},challenged_id.eq.${challengedId}`)
      .in("status", ["pending", "active"])
      .maybeSingle()

    if (challengedExistingError) {
      console.error("[v0] Error checking challenged user's existing challenges:", challengedExistingError)
      return NextResponse.json({ error: "Failed to check challenged user's challenges" }, { status: 500 })
    }

    if (challengedExisting) {
      return NextResponse.json({ error: "The challenged user already has an active or pending challenge" }, { status: 400 })
    }

    // Deduct wager from challenger balance
    const { error: updateBalanceError } = await supabase
      .from("game_stats")
      .update({ total_money: challengerStats.total_money - wagerAmount })
      .eq("user_id", user.id)

    if (updateBalanceError) {
      console.error("[v0] Failed to deduct wager:", updateBalanceError)
      return NextResponse.json({ error: "Failed to deduct wager" }, { status: 500 })
    }

    // Create challenge
    const { data: challenge, error: challengeError } = await supabase
      .from("challenges")
      .insert({
        challenger_id: user.id,
        challenged_id: challengedId,
        wager_amount: wagerAmount,
        duration_minutes: durationMinutes,
        status: "pending",
      })
      .select()
      .single()

    if (challengeError) {
      console.error("[v0] Failed to create challenge:", challengeError)
      // Rollback balance deduction
      await supabase
        .from("game_stats")
        .update({ total_money: challengerStats.total_money })
        .eq("user_id", user.id)
      return NextResponse.json({ error: "Failed to create challenge" }, { status: 500 })
    }

    // Fetch user profiles for formatted response
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", [challenge.challenger_id, challenge.challenged_id])

    if (profilesError) {
      console.error("[v0] User profiles fetch error (non-blocking):", profilesError)
    }

    const profilesMap = new Map(profiles?.map((profile) => [profile.id, profile]) || [])

    const formattedChallenge = formatChallengeResponse(challenge as ChallengeRecord, profilesMap)
    
    console.log("[v0] Challenge created successfully:", {
      challengeId: formattedChallenge.id,
      challengerId: formattedChallenge.challengerId,
      challengedId: formattedChallenge.challengedId,
    })

    return NextResponse.json({
      challenge: formattedChallenge,
    })
  } catch (err) {
    console.error("[v0] Challenge creation error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
