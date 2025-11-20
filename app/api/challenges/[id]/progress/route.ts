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
    const body = await request.json()
    const { creditBalance, xpDelta } = body as { creditBalance?: number; xpDelta?: number }

    if (creditBalance === undefined && xpDelta === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    // Fetch challenge with service client to avoid RLS issues while still checking membership below.
    const { data: challenge, error: fetchError } = await admin
      .from("challenges")
      .select("*")
      .eq("id", (await params).id)
      .single()

    if (fetchError || !challenge) {
      console.error("[v0] Challenge progress fetch error:", fetchError)
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    if (challenge.status !== "active") {
      return NextResponse.json({ error: "Challenge is not active" }, { status: 400 })
    }

    const isChallenger = challenge.challenger_id === user.id
    const isChallenged = challenge.challenged_id === user.id

    if (!isChallenger && !isChallenged) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (typeof creditBalance === "number" && Number.isFinite(creditBalance)) {
      const sanitized = Math.max(0, Math.round(creditBalance))
      if (isChallenger) {
        updates.challenger_credit_balance = sanitized
      } else {
        updates.challenged_credit_balance = sanitized
      }
    }

    if (typeof xpDelta === "number" && xpDelta > 0) {
      const currentXp = isChallenger
        ? challenge.challenger_credit_experience || 0
        : challenge.challenged_credit_experience || 0
      const incremented = currentXp + Math.round(xpDelta)
      if (isChallenger) {
        updates.challenger_credit_experience = incremented
      } else {
        updates.challenged_credit_experience = incremented
      }
    }

    if (Object.keys(updates).length === 1) {
      // Only updated_at would be sent
      return NextResponse.json({ error: "No valid progress values supplied" }, { status: 400 })
    }

    const { data: updatedChallenge, error: updateError } = await admin
      .from("challenges")
      .update(updates)
      .eq("id", (await params).id)
      .select("*")
      .single()

    if (updateError || !updatedChallenge) {
      console.error("[v0] Challenge progress update error:", updateError)
      return NextResponse.json({ error: "Failed to update challenge progress" }, { status: 500 })
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
    console.error("[v0] Challenge progress route error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
