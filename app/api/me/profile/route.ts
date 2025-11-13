import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("display_name, email, avatar_url")
      .eq("id", user.id)
      .single()

    if (error) {
      console.error("[v0] Failed to fetch profile:", error)
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
    }

    // Also fetch game stats for balance
    const { data: stats, error: statsError } = await supabase
      .from("game_stats")
      .select("total_money")
      .eq("user_id", user.id)
      .single()

    if (statsError) {
      console.error("[v0] Failed to fetch stats:", statsError)
    }

    return NextResponse.json({ profile, stats: stats ? { total_money: stats.total_money } : null })
  } catch (error) {
    console.error("[v0] Error in profile GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { displayName } = await request.json()

    if (!displayName || typeof displayName !== "string") {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 })
    }

    const trimmedName = displayName.trim()
    if (trimmedName.length < 3 || trimmedName.length > 30) {
      return NextResponse.json({ error: "Username must be between 3 and 30 characters" }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ display_name: trimmedName, updated_at: new Date().toISOString() })
      .eq("id", user.id)

    if (updateError) {
      console.error("[v0] Failed to update profile:", updateError)
      return NextResponse.json({ error: "Failed to update username" }, { status: 500 })
    }

    console.log("[v0] username_updated", { userId: user.id, newName: trimmedName })

    return NextResponse.json({ message: "Username updated successfully", displayName: trimmedName })
  } catch (error) {
    console.error("[v0] Error in profile PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
