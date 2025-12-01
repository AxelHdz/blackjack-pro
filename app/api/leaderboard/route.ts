import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

type LeaderboardRow = {
  user_id: string
  total_money: number
  level: number
  user_profiles: {
    display_name: string | null
    avatar_url: string | null
  }[]
}

type LeaderboardEntry = {
  userId: string
  name: string
  avatarUrl: string | null
  currentBalance: number
  level: number
  rank: number
}

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
  const cursor = searchParams.get("cursor")
  const limit = 50

  try {
    let query = supabase.from("game_stats").select(`
        user_id,
        total_money,
        level,
        user_profiles!inner(display_name, avatar_url)
      `)

    // Apply scope filter
    if (scope === "friends") {
      const { data: friendsData, error: friendsError } = await supabase
        .from("friends")
        .select("friend_user_id")
        .eq("user_id", user.id)

      if (friendsError) {
        console.error("Friends fetch error:", friendsError)
      }

      const friendIds = friendsData?.map((f) => f.friend_user_id) || []
      // Include user's own ID to see themselves in friends view
      friendIds.push(user.id)

      query = query.in("user_id", friendIds)
    }

    // Apply sorting
    if (metric === "balance") {
      query = query.order("total_money", { ascending: false }).order("level", { ascending: false })
    } else {
      query = query.order("level", { ascending: false }).order("total_money", { ascending: false })
    }
    // Deterministic tie-breaker to match rank calculation
    query = query.order("user_id", { ascending: true })

    // Apply pagination
    if (cursor) {
      const cursorValue = Number.parseInt(cursor)
      query = query.range(cursorValue, cursorValue + limit - 1)
    } else {
      query = query.range(0, limit - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error("Leaderboard query error:", error)
      return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
    }

    // Transform data to include rank
    const entries: LeaderboardEntry[] =
      data?.map((entry: LeaderboardRow, index) => ({
        userId: entry.user_id,
        name: entry.user_profiles[0]?.display_name || `User ${entry.user_id.slice(-4)}`,
        avatarUrl: entry.user_profiles[0]?.avatar_url ?? null,
        currentBalance: entry.total_money,
        level: entry.level,
        rank: (cursor ? Number.parseInt(cursor) : 0) + index + 1,
      })) || []

    const nextCursor = entries.length === limit ? ((cursor ? Number.parseInt(cursor) : 0) + limit).toString() : null

    return NextResponse.json(
      { entries, nextCursor },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    )
  } catch (err) {
    console.error("Leaderboard error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
