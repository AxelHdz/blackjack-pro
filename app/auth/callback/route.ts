import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const friendId = requestUrl.searchParams.get("friend") // Preserve friend parameter
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  const redirectPath = friendId ? `/?friend=${friendId}` : "/"
  return NextResponse.redirect(`${origin}${redirectPath}`)
}
