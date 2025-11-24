import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

function deriveDisplayName(email: string | null, userMetadata: Record<string, unknown>): string {
  const fromMeta =
    (userMetadata?.display_name as string | undefined) ||
    (userMetadata?.full_name as string | undefined) ||
    (userMetadata?.name as string | undefined) ||
    (userMetadata?.nickname as string | undefined)

  const fallback = email ? email.split("@")[0] : "Player"
  const source = fromMeta && typeof fromMeta === "string" ? fromMeta : fallback
  return source.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30) || "Player"
}

async function ensureProfileAndStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email: string | null; user_metadata: Record<string, unknown> },
) {
  const timestamp = new Date().toISOString()
  const displayName = deriveDisplayName(user.email, user.user_metadata || {})

  // Ensure profile exists
  const { data: existingProfile, error: profileFetchError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()

  if (!existingProfile && !profileFetchError) {
    const { error: insertProfileError } = await supabase.from("user_profiles").insert({
      id: user.id,
      email: user.email,
      display_name: displayName,
      created_at: timestamp,
      updated_at: timestamp,
    })

    if (insertProfileError) {
      console.error("Failed to create profile after OAuth callback:", insertProfileError)
    }
  }

  // Ensure stats exist
  const { data: existingStats, error: statsFetchError } = await supabase
    .from("game_stats")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!existingStats && !statsFetchError) {
    const { error: insertStatsError } = await supabase.from("game_stats").insert({
      user_id: user.id,
      total_money: 500,
      level: 1,
      experience: 0,
      created_at: timestamp,
      updated_at: timestamp,
    })

    if (insertStatsError) {
      console.error("Failed to create game stats after OAuth callback:", insertStatsError)
    }
  }
}

// Map error codes to user-friendly messages
function getErrorMessage(error: string, errorDescription: string | null): string {
  const errorLower = error.toLowerCase()
  
  if (errorLower.includes("access_denied")) {
    return "This magic link is invalid or has expired. Please request a new one."
  }
  
  if (errorLower.includes("expired_token") || errorLower.includes("expired")) {
    return "This magic link has expired. Please request a new one."
  }
  
  if (errorLower.includes("invalid_token") || errorLower.includes("invalid")) {
    return "This magic link is invalid. Please request a new one."
  }
  
  // Use error description if available, otherwise use the error code
  return errorDescription || error || "An authentication error occurred. Please try again."
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const error = requestUrl.searchParams.get("error")
  const errorDescription = requestUrl.searchParams.get("error_description")
  const setPassword = requestUrl.searchParams.get("setPassword")
  const recoveryType = requestUrl.searchParams.get("type")
  const friendId = requestUrl.searchParams.get("friend")
  const origin = requestUrl.origin

  // Handle authentication errors
  if (error) {
    console.error("Auth callback error:", error, errorDescription)
    const friendlyMessage = getErrorMessage(error, errorDescription)
    const redirectPath = friendId 
      ? `/auth/login?error=${encodeURIComponent(friendlyMessage)}&friend=${encodeURIComponent(friendId)}` 
      : `/auth/login?error=${encodeURIComponent(friendlyMessage)}`
    return NextResponse.redirect(`${origin}${redirectPath}`)
  }

  // Handle missing code scenario (expired/invalid link)
  if (!code) {
    const friendlyMessage = "This magic link is invalid or has expired. Please request a new one."
    const redirectPath = friendId
      ? `/auth/login?error=${encodeURIComponent(friendlyMessage)}&friend=${encodeURIComponent(friendId)}`
      : `/auth/login?error=${encodeURIComponent(friendlyMessage)}`
    return NextResponse.redirect(`${origin}${redirectPath}`)
  }

  // Exchange code for session (works for OAuth, magic links, and email confirmation)
  // This automatically creates a session and stores it in cookies via the server client
  const supabase = await createClient()
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  
  if (exchangeError) {
    console.error("Session exchange error:", exchangeError)
    const friendlyMessage = getErrorMessage(exchangeError.message, null)
    const redirectPath = friendId 
      ? `/auth/login?error=${encodeURIComponent(friendlyMessage)}&friend=${encodeURIComponent(friendId)}` 
      : `/auth/login?error=${encodeURIComponent(friendlyMessage)}`
    return NextResponse.redirect(`${origin}${redirectPath}`)
  }

  // Verify session was created successfully
  if (!data.session) {
    console.error("Session exchange succeeded but no session was returned")
    const friendlyMessage = "Failed to create session. Please try again."
    const redirectPath = friendId 
      ? `/auth/login?error=${encodeURIComponent(friendlyMessage)}&friend=${encodeURIComponent(friendId)}` 
      : `/auth/login?error=${encodeURIComponent(friendlyMessage)}`
    return NextResponse.redirect(`${origin}${redirectPath}`)
  }

  // Session is now stored in cookies via the server client's setAll callback
  // The user is automatically logged in at this point

  // Ensure profile and stats exist for users coming from OAuth/magic links
  try {
    await ensureProfileAndStats(supabase, {
      id: data.session.user.id,
      email: data.session.user.email ?? null,
      user_metadata: data.session.user.user_metadata || {},
    })
  } catch (createError) {
    console.error("Failed to ensure profile/stats after callback:", createError)
  }

  // Check if this is a password recovery flow
  if (recoveryType === "recovery") {
    const redirectPath = friendId
      ? `/auth/reset-password?friend=${encodeURIComponent(friendId)}`
      : "/auth/reset-password"
    return NextResponse.redirect(`${origin}${redirectPath}`)
  }

  // Check if user wants to set password
  if (setPassword === "true") {
    const redirectPath = friendId
      ? `/auth/set-password?friend=${encodeURIComponent(friendId)}`
      : "/auth/set-password"
    return NextResponse.redirect(`${origin}${redirectPath}`)
  }

  // Normal redirect to home - user is now logged in
  const redirectPath = friendId ? `/?friend=${encodeURIComponent(friendId)}` : "/"
  return NextResponse.redirect(`${origin}${redirectPath}`)
}
