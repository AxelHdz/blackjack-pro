import type React from "react"
import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ForgotPasswordForm } from "./forgot-password-form"

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
