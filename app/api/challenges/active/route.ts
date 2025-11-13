import { createClient } from "@/lib/supabase/server"
import { formatChallengeResponse, type ChallengeRecord } from "@/lib/challenge-helpers"
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

    return NextResponse.json(formatChallengeResponse(challenge as ChallengeRecord, profilesMap))
  } catch (err) {
    console.error("[v0] Active challenge error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
