import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// GET pending friend requests
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
    const { data: requestsData, error } = await supabase
      .from("friend_requests")
      .select("id, from_user_id, created_at")
      .eq("to_user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Friend requests fetch error:", error)
      return NextResponse.json({ error: "Failed to fetch friend requests" }, { status: 500 })
    }

    if (!requestsData || requestsData.length === 0) {
      return NextResponse.json({ requests: [] })
    }

    const userIds = requestsData.map((req) => req.from_user_id)

    const { data: profilesData, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", userIds)

    if (profilesError) {
      console.error("[v0] User profiles fetch error:", profilesError)
    }

    const profilesMap = new Map(profilesData?.map((profile) => [profile.id, profile]) || [])

    const { data: statsData, error: statsError } = await supabase
      .from("game_stats")
      .select("user_id, total_money, level")
      .in("user_id", userIds)

    if (statsError) {
      console.error("[v0] Game stats fetch error:", statsError)
    }

    const statsMap = new Map(statsData?.map((stat) => [stat.user_id, stat]) || [])

    const requests = requestsData.map((req) => {
      const profile = profilesMap.get(req.from_user_id)
      const stats = statsMap.get(req.from_user_id)
      return {
        id: req.id,
        fromUserId: req.from_user_id,
        name: profile?.display_name || `User ${req.from_user_id.slice(0, 8)}`,
        currentBalance: stats?.total_money || 0,
        level: stats?.level || 1,
        createdAt: req.created_at,
      }
    })

    return NextResponse.json({ requests })
  } catch (err) {
    console.error("[v0] Friend requests error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST to respond to a friend request (accept/reject)
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
    const { requestId, action } = body

    if (!requestId || !action || !["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    // Update the request status
    const { data: requestData, error: updateError } = await supabase
      .from("friend_requests")
      .update({ status: action === "accept" ? "accepted" : "rejected", updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("to_user_id", user.id)
      .select("from_user_id")
      .single()

    if (updateError || !requestData) {
      console.error("[v0] Friend request update error:", updateError)
      return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
    }

    // If accepted, add to friends table (bidirectional)
    if (action === "accept") {
      const { error: friendshipError } = await supabase.rpc("create_bidirectional_friendship", {
        user1_id: user.id,
        user2_id: requestData.from_user_id,
      })

      if (friendshipError) {
        console.error("[v0] Friend add error:", friendshipError)
        return NextResponse.json({ error: "Failed to add friend" }, { status: 500 })
      }
    }

    console.log("[v0] friend_request_responded", { userId: user.id, requestId, action })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[v0] Friend request response error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
