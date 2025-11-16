import { createClient } from "@/lib/supabase/server"
import { finalizeChallenge } from "@/lib/challenge-finalize"
import { type ChallengeRecord } from "@/lib/challenge-helpers"
import { NextResponse, type NextRequest } from "next/server"

// POST: Forfeit an active challenge (loser triggers this)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data: challenge, error: fetchError } = await supabase
      .from("challenges")
      .select("*")
      .eq("id", params.id)
      .single()

    if (fetchError || !challenge) {
      console.error("[v0] Challenge fetch error (forfeit):", fetchError)
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

    const winnerId = isChallenger ? challenge.challenged_id : challenge.challenger_id

    const result = await finalizeChallenge({
      supabase,
      challenge: challenge as ChallengeRecord,
      winnerId,
      challengerCredits: challenge.challenger_credit_balance ?? 0,
      challengedCredits: challenge.challenged_credit_balance ?? 0,
      allowTie: false,
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
    console.error("[v0] Challenge forfeit error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
