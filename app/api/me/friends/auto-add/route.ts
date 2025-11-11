import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { friendUserId } = await request.json()

    if (!friendUserId || typeof friendUserId !== "string") {
      return NextResponse.json({ error: "Friend user ID is required" }, { status: 400 })
    }

    // Can't friend yourself
    if (friendUserId === user.id) {
      return NextResponse.json({ success: false, message: "Cannot add yourself" }, { status: 200 })
    }

    // Check if they're already friends
    const { data: existingFriendship } = await supabase
      .from("friends")
      .select("*")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${user.id})`,
      )
      .limit(1)

    if (existingFriendship && existingFriendship.length > 0) {
      return NextResponse.json({ success: false, message: "Already friends" }, { status: 200 })
    }

    // Create bidirectional friendship (both users become friends automatically)
    const { error: friendship1Error } = await supabase.from("friends").insert({
      user_id: user.id,
      friend_id: friendUserId,
      created_at: new Date().toISOString(),
    })

    const { error: friendship2Error } = await supabase.from("friends").insert({
      user_id: friendUserId,
      friend_id: user.id,
      created_at: new Date().toISOString(),
    })

    if (friendship1Error || friendship2Error) {
      console.error("[v0] Error creating friendship:", friendship1Error || friendship2Error)
      return NextResponse.json({ error: "Failed to create friendship" }, { status: 500 })
    }

    console.log("[v0] friend_added_via_referral", { referrerId: friendUserId, newFriendId: user.id })

    return NextResponse.json({
      success: true,
      message: "Friend added successfully",
    })
  } catch (error) {
    console.error("[v0] Auto-add friend error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
