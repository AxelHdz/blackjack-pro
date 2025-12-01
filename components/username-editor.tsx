"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Pencil, Check, X } from "lucide-react"

interface UsernameEditorProps {
  initialUsername: string
  onUpdate: (newUsername: string) => void
}

export function UsernameEditor({ initialUsername, onUpdate }: UsernameEditorProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [username, setUsername] = useState(initialUsername)
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    if (!username.trim() || username === initialUsername) {
      setIsEditing(false)
      setUsername(initialUsername)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: username.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to update username",
          variant: "destructive",
        })
        setUsername(initialUsername)
        return
      }

      toast({
        title: "Success",
        description: "Username updated successfully",
      })

      onUpdate(data.displayName)
      setIsEditing(false)
    } catch (error) {
      console.error("Failed to update username:", error)
      toast({
        title: "Error",
        description: "Failed to update username",
        variant: "destructive",
      })
      setUsername(initialUsername)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setUsername(initialUsername)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave()
            if (e.key === "Escape") handleCancel()
          }}
          disabled={isLoading}
          className="h-8 text-sm"
          maxLength={30}
          autoFocus
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={handleSave}
          disabled={isLoading}
          aria-label="Save username"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={handleCancel}
          disabled={isLoading}
          aria-label="Cancel edit"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{initialUsername}</span>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={() => setIsEditing(true)}
        aria-label="Edit username"
      >
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  )
}
