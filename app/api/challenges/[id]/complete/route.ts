import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { finalizeChallenge } from "@/lib/challenge-finalize"
import type { ChallengeRecord } from "@/lib/challenge-helpers"
import { type NextRequest, NextResponse } from "next/server"

// POST: Complete challenge (called when timer expires)
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
    const { data: challenge, error: fetchError } = await admin
      .from("challenges")
      .select("*")
      .eq("id", (await params).id)
      .single()

    if (fetchError || !challenge) {
      console.error("Challenge fetch error:", fetchError)
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    const isChallenger = challenge.challenger_id === user.id
    const isChallenged = challenge.challenged_id === user.id

    if (!isChallenger && !isChallenged) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (challenge.status !== "active") {
      return NextResponse.json({ error: "Challenge is not active" }, { status: 400 })
    }

    if (challenge.expires_at) {
      const expiresAt = new Date(challenge.expires_at)
      if (new Date() < expiresAt) {
        return NextResponse.json({ error: "Challenge has not expired yet" }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: "Challenge expiration missing" }, { status: 400 })
    }

    const challengerCredits = Math.max(0, challenge.challenger_credit_balance ?? 0)
    const challengedCredits = Math.max(0, challenge.challenged_credit_balance ?? 0)

    let winnerId: string | null = null
    if (challengerCredits > challengedCredits) {
      winnerId = challenge.challenger_id
    } else if (challengedCredits > challengerCredits) {
      winnerId = challenge.challenged_id
    }

    const result = await finalizeChallenge({
      supabase: admin,
      challenge: challenge as ChallengeRecord,
      winnerId,
      challengerCredits,
      challengedCredits,
      allowTie: true,
    })

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      challenge: result.formattedChallenge,
      winnerId: result.winnerId,
      winnerName: result.winnerName,
      challengerCredits: result.challengerCredits,
      challengedCredits: result.challengedCredits,
      xpResults: result.xpResults,
      isTie: result.isTie,
    })
  } catch (err) {
    console.error("Challenge completion error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
