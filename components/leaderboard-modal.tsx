"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Copy, UserPlus, X, Check, XIcon } from "lucide-react"
import { UsernameEditor } from "@/components/username-editor"

interface LeaderboardEntry {
  userId: string
  name: string
  avatarUrl?: string
  currentBalance: number
  level: number
  rank: number
}

interface FriendRequest {
  id: string
  fromUserId: string
  name: string
  currentBalance: number
  level: number
  createdAt: string
}

interface LeaderboardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
}

export function LeaderboardModal({ open, onOpenChange, userId }: LeaderboardModalProps) {
  const { toast } = useToast()
  const [metric, setMetric] = useState<"balance" | "level">("balance")
  const [scope, setScope] = useState<"global" | "friends">("global")
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [friendInput, setFriendInput] = useState("")
  const [friends, setFriends] = useState<string[]>([])
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [showRequests, setShowRequests] = useState(false)
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [copiedUserId, setCopiedUserId] = useState(false)
  const [userDisplayName, setUserDisplayName] = useState<string>("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      console.log("[v0] leaderboard_opened", { scope, metric })
      loadLeaderboard(true)
      loadFriends()
      loadFriendRequests()
      loadUserProfile()

      const savedScope = localStorage.getItem("leaderboard_scope") as "global" | "friends" | null
      const savedMetric = localStorage.getItem("leaderboard_metric") as "balance" | "level" | null
      if (savedScope) setScope(savedScope)
      if (savedMetric) setMetric(savedMetric)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      loadLeaderboard(true)
      localStorage.setItem("leaderboard_scope", scope)
      localStorage.setItem("leaderboard_metric", metric)
    }
  }, [metric, scope])

  useEffect(() => {
    const handleFocus = () => {
      if (inputRef.current && window.innerWidth < 768) {
        setTimeout(() => {
          inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 300)
      }
    }

    const input = inputRef.current
    if (input) {
      input.addEventListener("focus", handleFocus)
      return () => input.removeEventListener("focus", handleFocus)
    }
  }, [showAddFriend])

  const loadLeaderboard = async (reset = false) => {
    try {
      setLoading(true)
      const cursor = reset ? null : nextCursor
      const response = await fetch(
        `/api/leaderboard?scope=${scope}&metric=${metric}${cursor ? `&cursor=${cursor}` : ""}`,
      )
      const data = await response.json()

      if (reset) {
        setEntries(data.entries)
      } else {
        setEntries((prev) => [...prev, ...data.entries])
      }
      setNextCursor(data.nextCursor)
    } catch (error) {
      console.error("[v0] Failed to load leaderboard:", error)
      toast({
        title: "Error",
        description: "Failed to load leaderboard",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadFriends = async () => {
    try {
      const response = await fetch("/api/me/friends")
      const data = await response.json()
      setFriends(data.friends || [])
    } catch (error) {
      console.error("[v0] Failed to load friends:", error)
    }
  }

  const loadFriendRequests = async () => {
    try {
      const response = await fetch("/api/me/friend-requests")
      const data = await response.json()
      setFriendRequests(data.requests || [])
    } catch (error) {
      console.error("[v0] Failed to load friend requests:", error)
    }
  }

  const loadUserProfile = async () => {
    try {
      const response = await fetch("/api/me/profile")
      const data = await response.json()
      if (data.profile?.display_name) {
        setUserDisplayName(data.profile.display_name)
      }
    } catch (error) {
      console.error("[v0] Failed to load user profile:", error)
    }
  }

  const handleAddFriend = async () => {
    if (!friendInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter a User ID",
        variant: "destructive",
      })
      return
    }

    if (friendInput.trim() === userId) {
      toast({
        title: "Error",
        description: "You cannot add yourself as a friend",
        variant: "destructive",
      })
      return
    }

    try {
      console.log("[v0] Sending friend request to:", friendInput.trim())

      const response = await fetch("/api/me/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendUserId: friendInput.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error("[v0] Friend request failed:", data.error)
        toast({
          title: "Error",
          description: data.error || "Failed to send friend request",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: data.message || "Friend request sent",
      })

      console.log("[v0] friend_request_sent", { friendUserId: friendInput.trim() })

      setFriendInput("")
      loadFriendRequests()
    } catch (error) {
      console.error("[v0] Failed to add friend:", error)
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive",
      })
    }
  }

  const handleRespondToRequest = async (requestId: string, action: "accept" | "reject") => {
    try {
      const response = await fetch("/api/me/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      })

      if (!response.ok) {
        toast({
          title: "Error",
          description: "Failed to respond to request",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: action === "accept" ? "Friend request accepted" : "Friend request rejected",
      })

      loadFriendRequests()
      loadFriends()
      if (scope === "friends") {
        loadLeaderboard(true)
      }
    } catch (error) {
      console.error("[v0] Failed to respond to request:", error)
      toast({
        title: "Error",
        description: "Failed to respond to request",
        variant: "destructive",
      })
    }
  }

  const handleCopyUserId = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://blackjack.axelhdz.com"
      const friendLink = `${baseUrl}?friend=${userId}`

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(friendLink)
      } else {
        const textArea = document.createElement("textarea")
        textArea.value = friendLink
        textArea.style.position = "fixed"
        textArea.style.left = "-999999px"
        textArea.style.top = "-999999px"
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand("copy")
        document.body.removeChild(textArea)
      }

      setCopiedUserId(true)
      toast({
        title: "Copied!",
        description: "Your friend link has been copied to clipboard",
      })

      setTimeout(() => setCopiedUserId(false), 2000)
    } catch (error) {
      console.error("[v0] Failed to copy friend link:", error)
      toast({
        title: "Error",
        description: "Failed to copy friend link",
        variant: "destructive",
      })
    }
  }

  const handleMetricChange = (value: string) => {
    if (value && (value === "balance" || value === "level")) {
      console.log("[v0] leaderboard_metric_changed", { from: metric, to: value })
      setMetric(value)
    }
  }

  const handleScopeChange = (value: string) => {
    console.log("[v0] leaderboard_scope_changed", { from: scope, to: value })
    setScope(value as "global" | "friends")
  }

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || loading || !nextCursor) return

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      loadLeaderboard(false)
    }
  }, [loading, nextCursor])

  const handleUsernameUpdate = (newUsername: string) => {
    setUserDisplayName(newUsername)
    loadLeaderboard(true) // Reload leaderboard to show updated username
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] md:max-h-[72vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-background z-10 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {friendRequests.length > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 relative"
                  onClick={() => {
                    setShowRequests(!showRequests)
                    setShowAddFriend(false)
                  }}
                  aria-label="View friend requests"
                >
                  <UserPlus className="h-4 w-4" />
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center p-0 text-[10px]"
                  >
                    {friendRequests.length}
                  </Badge>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    setShowAddFriend(!showAddFriend)
                    setShowRequests(false)
                  }}
                  aria-label="Add friend"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              )}
            </div>
            <DialogTitle className="absolute left-1/2 -translate-x-1/2">Leaderboard</DialogTitle>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => onOpenChange(false)}
              aria-label="Close leaderboard"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="sr-only">View global or friends leaderboard rankings</DialogDescription>

          <div className="flex items-center gap-3 mt-3">
            <Tabs value={scope} onValueChange={handleScopeChange} className="flex-shrink-0">
              <TabsList>
                <TabsTrigger value="global" className="px-4">
                  Global
                </TabsTrigger>
                <TabsTrigger value="friends" className="px-4">
                  Friends
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs value={metric} onValueChange={handleMetricChange} className="flex-shrink-0">
              <TabsList>
                <TabsTrigger value="balance" aria-label="Sort by balance" className="px-4">
                  Balance
                </TabsTrigger>
                <TabsTrigger value="level" aria-label="Sort by level" className="px-4">
                  Level
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {showRequests && friendRequests.length > 0 ? (
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Friend Requests</h3>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowRequests(false)}>
                  Back
                </Button>
              </div>

              <div className="space-y-2">
                {friendRequests.map((request) => (
                  <div key={request.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                      {request.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{request.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ${request.currentBalance.toLocaleString()} · Lvl {request.level}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 w-8 p-0"
                        onClick={() => handleRespondToRequest(request.id, "accept")}
                        aria-label="Accept friend request"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 w-8 p-0"
                        onClick={() => handleRespondToRequest(request.id, "reject")}
                        aria-label="Reject friend request"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={() => {
                    setShowRequests(false)
                    setShowAddFriend(true)
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Send Friend Request
                </Button>
              </div>
            </div>
          ) : (
            <ScrollArea ref={scrollRef} onScrollCapture={handleScroll} className="flex-1 px-6 min-h-[320px]">
              {loading && entries.length === 0 ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-muted" />
                      <div className="flex-1">
                        <div className="h-4 w-24 bg-muted rounded mb-1" />
                        <div className="h-3 w-16 bg-muted rounded" />
                      </div>
                      <div className="h-4 w-12 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    {scope === "friends" ? "No friends yet — add some using a User ID." : "No leaderboard entries yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-1 pb-4">
                  {entries.map((entry) => (
                    <div
                      key={entry.userId}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        entry.userId === userId ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="w-8 text-sm font-bold text-muted-foreground">#{entry.rank}</div>
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                        {entry.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        {entry.userId === userId ? (
                          <div className="flex items-center gap-1 mb-1">
                            <UsernameEditor initialUsername={entry.name} onUpdate={handleUsernameUpdate} />
                          </div>
                        ) : (
                          <div className="text-sm font-medium truncate">{entry.name}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {metric === "balance" ? (
                            <>
                              <span className="font-semibold">${entry.currentBalance.toLocaleString()}</span>
                              {" · "}Lvl {entry.level}
                            </>
                          ) : (
                            <>
                              <span className="font-semibold">Lvl {entry.level}</span>
                              {" · "}${entry.currentBalance.toLocaleString()}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && <div className="text-center py-2 text-xs text-muted-foreground">Loading more...</div>}
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        {showAddFriend && !showRequests && (
          <div className="px-6 pb-4 md:pb-4 pt-3 border-t border-border bg-background flex-shrink-0 sticky bottom-0">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Add Friends</div>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
                  <span className="text-xs text-muted-foreground truncate font-mono">{userId.slice(0, 8)}...</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 ml-auto"
                    onClick={handleCopyUserId}
                    aria-label="Copy my user ID"
                  >
                    {copiedUserId ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  placeholder="Friend's User ID"
                  value={friendInput}
                  onChange={(e) => setFriendInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
                  className="flex-1 text-sm"
                  aria-label="Friend's user ID"
                />
                <Button
                  onClick={handleAddFriend}
                  size="sm"
                  aria-label="Add friend by user ID"
                  disabled={!friendInput.trim()}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Friends appear in your leaderboard.</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
