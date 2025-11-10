import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BlackjackGame } from "@/components/blackjack-game"

export default async function Home() {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  return (
    <main className="h-dvh overflow-hidden bg-black">
      <BlackjackGame userId={user.id} />
    </main>
  )
}
