"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { EmailSentCard } from "@/components/auth/email-sent-card"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useMemo, useEffect } from "react"
import Link from "next/link"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [loginMethod, setLoginMethod] = useState<"password" | "magic-link">("magic-link")
  const router = useRouter()
  const searchParams = useSearchParams() // Get search params
  const supabase = useMemo(() => createClient(), [])

  // Check for error query parameter from callback route
  useEffect(() => {
    const errorParam = searchParams.get("error")
    if (errorParam) {
      setError(errorParam)
      // Clean up URL by removing error parameter
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete("error")
      window.history.replaceState({}, "", newUrl.toString())
    }
  }, [searchParams])

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        // Check if the error is due to invalid credentials (user doesn't exist)
        if (
          signInError.message.includes("Invalid login credentials") ||
          signInError.message.includes("Check your email for a confirmation link.")
        ) {
          // Try to create a new account
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || window.location.origin,
              data: {
                email_confirmed: true,
              },
            },
          })

          if (signUpError) {
            // Check if signup failed because user already exists (magic-link user)
            if (
              signUpError.message.includes("User already registered") ||
              signUpError.message.includes("already registered")
            ) {
              // User exists but doesn't have a password - send magic link to set password
              const friendId = searchParams.get("friend")
              const redirectTo = friendId
                ? `${window.location.origin}/auth/callback?setPassword=true&friend=${encodeURIComponent(friendId)}`
                : `${window.location.origin}/auth/callback?setPassword=true`

              const { error: magicLinkError } = await supabase.auth.signInWithOtp({
                email,
                options: {
                  emailRedirectTo: redirectTo,
                  shouldCreateUser: false,
                },
              })

              if (magicLinkError) throw magicLinkError

              // Show success message
              setMagicLinkSent(true)
              setIsLoading(false)
              return
            }
            throw signUpError
          }

          // After successful signup, sign in automatically
          const { error: autoSignInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (autoSignInError) throw autoSignInError
        } else {
          throw signInError
        }
      }

      const friendId = searchParams.get("friend")
      const redirectPath = friendId ? `/?friend=${encodeURIComponent(friendId)}` : "/"
      router.push(redirectPath)
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsLoading(false)
    }
  }

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const friendId = searchParams.get("friend")
      const redirectTo = friendId
        ? `${window.location.origin}/auth/callback?friend=${encodeURIComponent(friendId)}`
        : `${window.location.origin}/auth/callback`

      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      })

      if (magicLinkError) {
        if (magicLinkError.message.includes("Signups not allowed")) {
          setError("Magic link signups are disabled. Please use the password tab or contact support.")
          setIsLoading(false)
          return
        }

        throw magicLinkError
      }

      setMagicLinkSent(true)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsLoading(false)
      return
    }

    setIsLoading(false)
  }

  if (magicLinkSent) {
    return (
      <EmailSentCard
        title="Check Your Email"
        description="We've sent you a magic link. Click it to finish signing in—no password required."
        email={email}
        additionalInfo="You can add a password later from the profile settings if you prefer."
        buttonText="Use a Different Email"
        onButtonClick={() => {
          setMagicLinkSent(false)
          setEmail("")
        }}
      />
    )
  }

  return (
    <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-background p-2 sm:p-4 touch-none overscroll-none">
      <div className="w-full max-w-sm">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center pb-4">
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">Blackjack Pro</CardTitle>
            <CardDescription className="text-sm sm:text-base text-muted-foreground">
              Sign in to save your progress
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={loginMethod} onValueChange={(value) => setLoginMethod(value as "password" | "magic-link")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="magic-link">Magic Link</TabsTrigger>
                <TabsTrigger value="password">Password</TabsTrigger>
              </TabsList>

              <TabsContent value="magic-link" className="space-y-3 mt-3">
                <form onSubmit={handleMagicLinkLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email-magic-link" className="text-sm font-medium text-foreground">
                      Email
                    </Label>
                    <Input
                      id="email-magic-link"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 bg-card border-border/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      We'll send you a secure link to sign in (and create your account if you're new).
                    </p>
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                    size="lg"
                  >
                    {isLoading ? "Sending..." : "Send Magic Link"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="password" className="space-y-3 mt-3">
                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email-password" className="text-sm font-medium text-foreground">
                      Email
                    </Label>
                    <Input
                      id="email-password"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 bg-card border-border/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm font-medium text-foreground">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 bg-card border-border/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Prefer a traditional login? Set a password once and use it anytime.
                    </p>
                  </div>
                  <div className="flex items-center justify-end">
                    <Link
                      href={
                        searchParams.get("friend")
                          ? `/auth/forgot-password?email=${encodeURIComponent(email)}&friend=${encodeURIComponent(searchParams.get("friend")!)}`
                          : `/auth/forgot-password?email=${encodeURIComponent(email)}`
                      }
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                    size="lg"
                  >
                    {isLoading ? "Processing..." : "Log In or Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {error && (
              <div className="p-2.5 rounded-lg bg-error/10 border border-error/20">
                <p className="text-sm text-error text-center">{error}</p>
              </div>
            )}

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
