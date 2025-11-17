import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { formatChallengeResponse, type ChallengeRecord } from "@/lib/challenge-helpers"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const admin = createServiceClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const resolvedParams = await params

    // Fetch challenge with service client to avoid RLS issues while still checking membership below.
    const { data: challenge, error: fetchError } = await admin
      .from("challenges")
      .select("*")
      .eq("id", resolvedParams.id)
      .single()

    if (fetchError || !challenge) {
      console.error("[v0] Challenge archive fetch error:", fetchError, "for ID:", resolvedParams.id)
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    // Check if user is a participant
    const isChallenger = challenge.challenger_id === user.id
    const isChallenged = challenge.challenged_id === user.id

    if (!isChallenger && !isChallenged) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Determine which archive field to update
    const updateField = isChallenger ? "challenger_archive_status" : "challenged_archive_status"

    // Archive the challenge for this user
    const { data: updatedChallenge, error: updateError } = await admin
      .from("challenges")
      .update({
        [updateField]: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resolvedParams.id)
      .select("*")
      .single()

    if (updateError || !updatedChallenge) {
      console.error("[v0] Challenge archive update error:", updateError)
      return NextResponse.json({ error: "Failed to archive challenge" }, { status: 500 })
    }

    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, display_name")
      .in("id", [updatedChallenge.challenger_id, updatedChallenge.challenged_id])

    const profilesMap = new Map(profiles?.map((profile) => [profile.id, profile]) || [])

    return NextResponse.json({
      challenge: formatChallengeResponse(updatedChallenge as ChallengeRecord, profilesMap),
    })
  } catch (err) {
    console.error("[v0] Challenge archive route error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
