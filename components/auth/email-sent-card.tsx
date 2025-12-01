"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface EmailSentCardProps {
  title: string
  description: string
  email: string
  additionalInfo?: string
  buttonText?: string
  onButtonClick: () => void
}

export function EmailSentCard({
  title,
  description,
  email,
  additionalInfo,
  buttonText = "Back to Login",
  onButtonClick,
}: EmailSentCardProps) {
  return (
    <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-background p-2 sm:p-4 touch-none overscroll-none">
      <div className="w-full max-w-sm">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center pb-4">
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</CardTitle>
            <CardDescription className="text-sm sm:text-base text-muted-foreground">{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-sm text-center text-muted-foreground">
                Email sent to: <span className="font-medium text-foreground">{email}</span>
              </p>
              {additionalInfo && (
                <p className="text-xs text-muted-foreground mt-2">{additionalInfo}</p>
              )}
            </div>
            <Button onClick={onButtonClick} variant="outline" className="w-full h-11" size="lg">
              {buttonText}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
