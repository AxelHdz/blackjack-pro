"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useRouter, useSearchParams } from "next/navigation" // Add useSearchParams
import { useState, useMemo, useEffect } from "react"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [loginMethod, setLoginMethod] = useState<"password" | "magic-link">("password")
  const router = useRouter()
  const searchParams = useSearchParams() // Get search params
  const supabase = useMemo(() => createClient(), [])

  // Check for error query parameter from callback route
  useEffect(() => {
    const errorParam = searchParams.get("error")
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
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
          signInError.message.includes("Email not confirmed")
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

          if (signUpError) throw signUpError

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
      const redirectPath = friendId ? `/?friend=${friendId}` : "/"
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
        ? `${window.location.origin}/auth/callback?friend=${friendId}`
        : `${window.location.origin}/auth/callback`

      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      })

      if (magicLinkError) throw magicLinkError

      setMagicLinkSent(true)
      setIsLoading(false)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsLoading(false)
    }
  }

  if (magicLinkSent) {
    return (
      <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-background p-2 sm:p-4 touch-none overscroll-none">
        <div className="w-full max-w-sm">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="space-y-2 text-center pb-4">
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">Check Your Email</CardTitle>
              <CardDescription className="text-sm sm:text-base text-muted-foreground">
                We've sent you a magic link to sign in. Click the link in your email to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-sm text-center text-muted-foreground">
                  Email sent to: <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>
              <Button
                onClick={() => {
                  setMagicLinkSent(false)
                  setEmail("")
                }}
                variant="outline"
                className="w-full h-11"
                size="lg"
              >
                Use a Different Email
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-background p-2 sm:p-4 touch-none overscroll-none">
      <div className="w-full max-w-sm">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center pb-4">
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">Blackjack Mastery </CardTitle>
            <CardDescription className="text-sm sm:text-base text-muted-foreground">
              Sign in to save your progress
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={loginMethod} onValueChange={(value) => setLoginMethod(value as "password" | "magic-link")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="magic-link">Magic Link</TabsTrigger>
              </TabsList>

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
                      We'll send you a secure link to sign in without a password.
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
