import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ChallengeProviderWrapper } from "@/components/challenge-provider-wrapper"

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ friend?: string }>
}) {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  const friendParams = await searchParams
  const friendId = friendParams?.friend

  if (error || !user) {
    const redirectUrl = friendId ? `/auth/login?friend=${friendId}` : "/auth/login"
    redirect(redirectUrl)
  }

  return (
    <main className="h-dvh overflow-hidden bg-black">
      <ChallengeProviderWrapper userId={user.id} friendReferralId={friendId} />
    </main>
  )
}
