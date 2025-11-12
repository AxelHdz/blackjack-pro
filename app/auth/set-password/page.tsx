"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useMemo, useEffect, Suspense } from "react"

function SetPasswordContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const friendId = searchParams.get("friend")

  // Check if user is authenticated
  useEffect(() => {
    let isMounted = true

    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!isMounted) return

      if (!user) {
        // Not authenticated, redirect to login
        const errorMessage = "You must be signed in to set a password. Please use the magic link from your email."
        const redirectPath = friendId
          ? `/auth/login?error=${encodeURIComponent(errorMessage)}&friend=${friendId}`
          : `/auth/login?error=${encodeURIComponent(errorMessage)}`
        setIsAuthenticated(false)
        router.push(redirectPath)
        return
      }

      setIsAuthenticated(true)
    }

    checkAuth()
    return () => {
      isMounted = false
    }
  }, [supabase, router, friendId])

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    // Validate password length
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    try {
      // Update user password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) throw updateError

      // Password set successfully, redirect to home
      const redirectPath = friendId ? `/?friend=${friendId}` : "/"
      router.push(redirectPath)
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsLoading(false)
    }
  }

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return <SetPasswordFallback />
  }

  // Don't render form if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-background p-2 sm:p-4 touch-none overscroll-none">
      <div className="w-full max-w-sm">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center pb-4">
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">Set Your Password</CardTitle>
            <CardDescription className="text-sm sm:text-base text-muted-foreground">
              Set a password for your account. You can use this password to sign in next time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleSetPassword} className="space-y-3">
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
                  minLength={6}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                  Confirm Password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 bg-card border-border/50"
                  minLength={6}
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                size="lg"
              >
                {isLoading ? "Setting Password..." : "Set Password"}
              </Button>
            </form>

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

function SetPasswordFallback() {
  return (
    <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-background p-2 sm:p-4 touch-none overscroll-none">
      <div className="w-full max-w-sm">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<SetPasswordFallback />}>
      <SetPasswordContent />
    </Suspense>
  )
}
