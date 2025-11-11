import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const error = requestUrl.searchParams.get("error")
  const errorDescription = requestUrl.searchParams.get("error_description")
  const friendId = requestUrl.searchParams.get("friend") // Preserve friend parameter
  const origin = requestUrl.origin

  // Handle authentication errors
  if (error) {
    console.error("Auth callback error:", error, errorDescription)
    const redirectPath = friendId ? `/auth/login?error=${encodeURIComponent(error)}&friend=${friendId}` : `/auth/login?error=${encodeURIComponent(error)}`
    return NextResponse.redirect(`${origin}${redirectPath}`)
  }

  // Exchange code for session (works for OAuth, magic links, and email confirmation)
  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (exchangeError) {
      console.error("Session exchange error:", exchangeError)
      const redirectPath = friendId ? `/auth/login?error=${encodeURIComponent(exchangeError.message)}&friend=${friendId}` : `/auth/login?error=${encodeURIComponent(exchangeError.message)}`
      return NextResponse.redirect(`${origin}${redirectPath}`)
    }
  }

  const redirectPath = friendId ? `/?friend=${friendId}` : "/"
  return NextResponse.redirect(`${origin}${redirectPath}`)
}
