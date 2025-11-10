import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

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
    const { data, error } = await supabase.from("friends").select("friend_user_id").eq("user_id", user.id)

    if (error) {
      console.error("[v0] Friends fetch error:", error)
      return NextResponse.json({ error: "Failed to fetch friends" }, { status: 500 })
    }

    const friends = data?.map((f) => f.friend_user_id) || []
    return NextResponse.json({ friends })
  } catch (err) {
    console.error("[v0] Friends error:", err)
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
    const { friendUserId } = body

    if (!friendUserId || friendUserId === user.id) {
      return NextResponse.json({ error: "Invalid friend user ID" }, { status: 400 })
    }

    // Check if friend user exists
    const { data: friendData, error: friendError } = await supabase
      .from("game_stats")
      .select("user_id")
      .eq("user_id", friendUserId)
      .single()

    if (friendError || !friendData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if already friends
    const { data: existingFriend } = await supabase
      .from("friends")
      .select("id")
      .eq("user_id", user.id)
      .eq("friend_user_id", friendUserId)
      .single()

    if (existingFriend) {
      return NextResponse.json({ error: "Already friends" }, { status: 409 })
    }

    // Check if request already exists
    const { data: existingRequest } = await supabase
      .from("friend_requests")
      .select("id, status")
      .eq("from_user_id", user.id)
      .eq("to_user_id", friendUserId)
      .single()

    if (existingRequest) {
      if (existingRequest.status === "pending") {
        return NextResponse.json({ error: "Friend request already sent" }, { status: 409 })
      }
    }

    // Create friend request
    const { error: insertError } = await supabase
      .from("friend_requests")
      .insert({ from_user_id: user.id, to_user_id: friendUserId, status: "pending" })

    if (insertError) {
      console.error("[v0] Friend request error:", insertError)
      return NextResponse.json({ error: "Failed to send friend request" }, { status: 500 })
    }

    console.log("[v0] friend_request_sent", { userId: user.id, friendUserId })

    return NextResponse.json({ ok: true, message: "Friend request sent" })
  } catch (err) {
    console.error("[v0] Send friend request error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
