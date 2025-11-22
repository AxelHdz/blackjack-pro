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

  try {
    // Get friend IDs if friends scope
    let friendIds: string[] | null = null
    if (scope === "friends") {
      const { data: friendsData, error: friendsError } = await supabase
        .from("friends")
        .select("friend_user_id")
        .eq("user_id", user.id)

      if (friendsError) {
        console.error("[v0] Failed to fetch friends for rank calculation:", friendsError)
        return NextResponse.json({ error: "Failed to fetch friends data" }, { status: 500 })
      }

      friendIds = friendsData?.map((f) => f.friend_user_id) || []
      friendIds.push(user.id)
    }

    // Use optimized database function to calculate rank
    // This leverages composite indexes for better performance at scale
    const { data: rankData, error: rankError } = await supabase.rpc("calculate_user_rank", {
      p_user_id: user.id,
      p_scope: scope,
      p_metric: metric,
      p_friend_ids: friendIds || [],
    })

    if (rankError || rankData === null) {
      console.error("[v0] Rank calculation error:", rankError)
      return NextResponse.json({ rank: null })
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
    console.error("[v0] Rank calculation error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
