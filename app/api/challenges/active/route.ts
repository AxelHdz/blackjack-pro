import { createClient } from "@/lib/supabase/server"
import { formatChallengeResponse, type ChallengeRecord } from "@/lib/challenge-helpers"
import { NextResponse } from "next/server"

// Force dynamic rendering since this is user-specific and requires authentication
export const dynamic = 'force-dynamic'

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
    // Optimized with composite indexes:
    // - idx_challenges_challenger_status_created: for challenger queries with status filter
    // - idx_challenges_challenged_status_created: for challenged queries with status filter
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
      return NextResponse.json(
        { challenge: null },
        {
          headers: {
            "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
          },
        },
      )
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

    const formatted = formatChallengeResponse(challenge as ChallengeRecord, profilesMap)
    return NextResponse.json(
      { challenge: formatted },
      {
        headers: {
          "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
        },
      },
    )
  } catch (err) {
    console.error("[v0] Active challenge error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
