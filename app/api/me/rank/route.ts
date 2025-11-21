import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// Force dynamic rendering since this is user-specific and requires authentication
export const dynamic = 'force-dynamic'

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

  try {
    // Get user's stats
    const { data: userStats, error: userError } = await supabase
      .from("game_stats")
      .select("total_money, level")
      .eq("user_id", user.id)
      .single()

    if (userError || !userStats) {
      return NextResponse.json(
        { rank: null },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        },
      )
    }

    let query = supabase.from("game_stats").select("user_id", { count: "exact", head: true })

    // Apply scope filter
    if (scope === "friends") {
      const { data: friendsData } = await supabase.from("friends").select("friend_user_id").eq("user_id", user.id)

      const friendIds = friendsData?.map((f) => f.friend_user_id) || []
      friendIds.push(user.id)
      query = query.in("user_id", friendIds)
    }

    // Count users with better stats
    if (metric === "balance") {
      query = query.or(
        [
          `total_money.gt.${userStats.total_money}`,
          `and(total_money.eq.${userStats.total_money},level.gt.${userStats.level})`,
          `and(total_money.eq.${userStats.total_money},level.eq.${userStats.level},user_id.lt.${user.id})`,
        ].join(","),
      )
    } else {
      query = query.or(
        [
          `level.gt.${userStats.level}`,
          `and(level.eq.${userStats.level},total_money.gt.${userStats.total_money})`,
          `and(level.eq.${userStats.level},total_money.eq.${userStats.total_money},user_id.lt.${user.id})`,
        ].join(","),
      )
    }

    const { count } = await query

    const rank = (count || 0) + 1

    return NextResponse.json(
      { rank },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    )
  } catch (err) {
    console.error("[v0] Rank calculation error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
