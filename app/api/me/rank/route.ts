import { createClient } from "@/lib/supabase/server"
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

  const searchParams = request.nextUrl.searchParams
  const scope = searchParams.get("scope") || "global"
  const metric = searchParams.get("metric") || "balance"

  const validScopes = ["global", "friends"] as const
  const validMetrics = ["balance", "level"] as const

  if (!validScopes.includes(scope as (typeof validScopes)[number])) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 })
  }

  if (!validMetrics.includes(metric as (typeof validMetrics)[number])) {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 })
  }

  try {
    // Verify stats exist so we can differentiate "no stats" from server errors
    const { data: stats, error: statsError } = await supabase
      .from("game_stats")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (statsError) {
      console.error("Failed to fetch stats for rank calculation:", statsError)
      return NextResponse.json({ error: "Failed to load stats" }, { status: 500 })
    }

    if (!stats) {
      return NextResponse.json({ error: "Stats not found" }, { status: 404 })
    }

    // Get friend IDs if friends scope
    let friendIds: string[] | null = null
    if (scope === "friends") {
      const { data: friendsData, error: friendsError } = await supabase
        .from("friends")
        .select("friend_user_id")
        .eq("user_id", user.id)

      if (friendsError) {
        console.error("Failed to fetch friends for rank calculation:", friendsError)
        return NextResponse.json({ error: "Failed to fetch friends data" }, { status: 500 })
      }

      friendIds = friendsData?.map((f) => f.friend_user_id) || []
      friendIds.push(user.id)
    }

    // Use optimized database function to calculate rank
    const { data: rankData, error: rankError } = await supabase.rpc("calculate_user_rank", {
      p_user_id: user.id,
      p_scope: scope,
      p_metric: metric,
      p_friend_ids: friendIds || [],
    })

    if (rankError) {
      console.error("Rank calculation error:", rankError)
      return NextResponse.json({ error: "Failed to calculate rank" }, { status: 500 })
    }

    if (rankData === null) {
      console.error("Rank calculation returned null for user:", user.id)
      return NextResponse.json({ error: "Rank unavailable" }, { status: 500 })
    }

    const rank = rankData

    return NextResponse.json(
      { rank },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    )
  } catch (err) {
    console.error("Rank calculation error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
