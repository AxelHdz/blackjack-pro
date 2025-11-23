"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmailSentCard } from "@/components/auth/email-sent-card"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useMemo, Suspense } from "react"
import Link from "next/link"

function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get("email") || ""
  const [email, setEmail] = useState(initialEmail)
  const [passwordResetSent, setPasswordResetSent] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const friendId = searchParams.get("friend")

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!email) {
      setError("Please enter your email address")
      setIsLoading(false)
      return
    }

    try {
      const redirectTo = friendId
        ? `${window.location.origin}/auth/callback?type=recovery&friend=${encodeURIComponent(friendId)}`
        : `${window.location.origin}/auth/callback?type=recovery`

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (resetError) throw resetError

      setPasswordResetSent(true)
      setIsLoading(false)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsLoading(false)
    }
  }

  if (passwordResetSent) {
    return (
      <EmailSentCard
        title="Check Your Email"
        description="We've sent you a password reset link. Click it to reset your password."
        email={email}
        additionalInfo="The link will expire in 1 hour for security reasons."
        buttonText="Back to Login"
        onButtonClick={() => {
          const redirectPath = friendId ? `/auth/login?friend=${encodeURIComponent(friendId)}` : "/auth/login"
          router.push(redirectPath)
        }}
      />
    )
  }

  return (
    <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-background p-2 sm:p-4 touch-none overscroll-none">
      <div className="w-full max-w-sm">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center pb-4">
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">Reset Password</CardTitle>
            <CardDescription className="text-sm sm:text-base text-muted-foreground">
              Enter your email address and we'll send you a link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handlePasswordReset} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email-reset" className="text-sm font-medium text-foreground">
                  Email
                </Label>
                <Input
                  id="email-reset"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 bg-card border-border/50"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                size="lg"
              >
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>

            {error && (
              <div className="p-2.5 rounded-lg bg-error/10 border border-error/20">
                <p className="text-sm text-error text-center">{error}</p>
              </div>
            )}

            <div className="pt-1 text-center">
              <p className="text-sm text-muted-foreground">
                Remember your password?{" "}
                <Link
                  href={friendId ? `/auth/login?friend=${encodeURIComponent(friendId)}` : "/auth/login"}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-background p-2 sm:p-4 touch-none overscroll-none">
        <div className="w-full max-w-sm">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="space-y-2 text-center pb-4">
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">Reset Password</CardTitle>
              <CardDescription className="text-sm sm:text-base text-muted-foreground">
                Loading...
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    }>
      <ForgotPasswordForm />
    </Suspense>
  )
}

