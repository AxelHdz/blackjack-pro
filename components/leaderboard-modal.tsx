"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Copy, UserPlus, X, Check, XIcon, Trophy, Swords } from "lucide-react"
import { UsernameEditor } from "@/components/username-editor"
import { ChallengeModal } from "@/components/challenge-modal"
import { type Challenge } from "@/types/challenge"
import { cn } from "@/lib/utils"
import { fetchCached } from "@/lib/fetch-cache"

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

const SHOW_CHALLENGE_BUTTONS = false

export function LeaderboardModal({ open, onOpenChange, userId }: LeaderboardModalProps) {
  const SHOW_CHALLENGE_BUTTONS = false
  const { toast } = useToast()
  const [metric, setMetric] = useState<"balance" | "level">("balance")
  const [scope, setScope] = useState<"global" | "friends">("global")
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [friends, setFriends] = useState<string[]>([])
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [showRequests, setShowRequests] = useState(false)
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [copiedUserId, setCopiedUserId] = useState(false)
  const [userDisplayName, setUserDisplayName] = useState<string>("")
  const [showChallengeModal, setShowChallengeModal] = useState(false)
  const [challengedUserId, setChallengedUserId] = useState<string>("")
  const [challengedUserName, setChallengedUserName] = useState<string>("")
  const [challengedUserBalance, setChallengedUserBalance] = useState<number>(0)
  const [userBalance, setUserBalance] = useState<number>(0)
  const [blockingChallenge, setBlockingChallenge] = useState<Challenge | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    console.log("[v0] leaderboard_opened", { scope, metric })
    const savedScope =
      typeof window !== "undefined" ? (localStorage.getItem("leaderboard_scope") as "global" | "friends" | null) : null
    const savedMetric =
      typeof window !== "undefined" ? (localStorage.getItem("leaderboard_metric") as "balance" | "level" | null) : null

    const scopeToUse = savedScope ?? scope
    const metricToUse = savedMetric ?? metric

    if (savedScope && savedScope !== scope) {
      setScope(savedScope)
    }
    if (savedMetric && savedMetric !== metric) {
      setMetric(savedMetric)
    }

    void loadLeaderboard(true, scopeToUse, metricToUse)
    void loadFriends()
    void loadFriendRequests()
    void loadUserProfile() // Combined function - loads both profile and balance
    void loadBlockingChallenge()
  }, [open])

  const loadLeaderboard = async (
    reset = false,
    scopeOverride?: "global" | "friends",
    metricOverride?: "balance" | "level",
  ) => {
    try {
      setLoading(true)
      const scopeToUse = scopeOverride ?? scope
      const metricToUse = metricOverride ?? metric
      const cursor = reset ? null : nextCursor
      const data = await fetchCached<{
        entries: LeaderboardEntry[]
        nextCursor: string | null
      }>(`/api/leaderboard?scope=${scopeToUse}&metric=${metricToUse}${cursor ? `&cursor=${cursor}` : ""}`)

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
      const data = await fetchCached<{ friends?: string[] }>("/api/me/friends")
      setFriends(data.friends || [])
    } catch (error) {
      console.error("[v0] Failed to load friends:", error)
    }
  }

  const loadFriendRequests = async () => {
    try {
      const data = await fetchCached<{ requests?: FriendRequest[] }>("/api/me/friend-requests")
      setFriendRequests(data.requests || [])
    } catch (error) {
      console.error("[v0] Failed to load friend requests:", error)
    }
  }

  // Combined function to fetch user profile data once instead of twice
  const loadUserProfile = async () => {
    try {
      const data = await fetchCached<{ profile?: { display_name?: string }; stats?: { total_money?: number } }>(
        "/api/me/profile",
      )
      if (data.profile?.display_name) {
        setUserDisplayName(data.profile.display_name)
      }
      if (data.stats?.total_money !== undefined) {
        setUserBalance(data.stats.total_money)
      }
    } catch (error) {
      console.error("[v0] Failed to load user profile:", error)
    }
  }

  const loadBlockingChallenge = async () => {
    try {
      const data = await fetchCached<{ challenges?: Challenge[] }>("/api/challenges?status=pending,active")
      if (Array.isArray(data.challenges) && data.challenges.length > 0) {
        setBlockingChallenge(data.challenges[0])
      } else {
        setBlockingChallenge(null)
      }
    } catch (error) {
      console.error("[v0] Failed to load challenge state:", error)
      setBlockingChallenge(null)
    }
  }

  const handleChallengeClick = (entry: LeaderboardEntry) => {
    if (blockingChallenge) {
      toast({
        title: "Challenge unavailable",
        description: "Finish or cancel your current challenge before starting a new one.",
        variant: "destructive",
      })
      return
    }
    setChallengedUserId(entry.userId)
    setChallengedUserName(entry.name)
    setChallengedUserBalance(entry.currentBalance)
    setShowChallengeModal(true)
    void loadUserProfile()
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
      const baseUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || "https://blackjack.axelhdz.com")
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
        description: "Your friend link has been copied to clipboard. Share it to automatically connect!",
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
      if (typeof window !== "undefined") {
        localStorage.setItem("leaderboard_metric", value)
      }
      void loadLeaderboard(true, scope, value)
    }
  }

  const handleScopeChange = (value: string) => {
    const nextScope = value as "global" | "friends"
    console.log("[v0] leaderboard_scope_changed", { from: scope, to: nextScope })
    setScope(nextScope)
    if (typeof window !== "undefined") {
      localStorage.setItem("leaderboard_scope", nextScope)
    }
    void loadLeaderboard(true, nextScope, metric)
  }

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || loading || !nextCursor) return

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      loadLeaderboard(false)
    }
  }, [loading, nextCursor, loadLeaderboard])

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

        {blockingChallenge && (
          <div className="px-6 pt-2 text-xs text-amber-400">
            Finish or cancel your current challenge before sending new requests.
          </div>
        )}

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
            <ScrollArea ref={scrollRef} onScrollCapture={handleScroll} className="px-6 h-[360px] md:h-[400px]">
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
                    {scope === "friends" ? "No friends yet — share your link to connect!" : "No leaderboard entries yet."}
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
                      <div className="w-8 flex items-center justify-center">
                        {entry.rank === 1 ? (
                          <Trophy className="h-5 w-5 text-yellow-500" />
                        ) : entry.rank === 2 ? (
                          <Trophy className="h-5 w-5 text-gray-400" />
                        ) : entry.rank === 3 ? (
                          <Trophy className="h-5 w-5 text-amber-800" />
                        ) : (
                          <span className="text-sm font-bold text-muted-foreground">#{entry.rank}</span>
                        )}
                      </div>
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
                      {entry.userId !== userId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={Boolean(blockingChallenge)}
                          className={cn(
                            "h-9 px-2 border border-white/20 rounded flex items-center gap-1.5",
                            blockingChallenge && "opacity-50 cursor-not-allowed",
                            !SHOW_CHALLENGE_BUTTONS && "hidden",
                          )}
                          onClick={() => handleChallengeClick(entry)}
                          aria-label={`Challenge ${entry.name}`}
                          title={
                            blockingChallenge
                              ? "Finish or cancel your current challenge before challenging someone new."
                              : undefined
                          }
                        >
                          <span className="text-xs font-medium">Challenge</span>
                          <Swords className="h-6 w-6" />
                        </Button>
                      )}
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
              <p className="text-xs text-muted-foreground">Share your link to automatically connect with friends.</p>
            </div>
          </div>
        )}
      </DialogContent>

      <ChallengeModal
        open={showChallengeModal}
        onOpenChange={setShowChallengeModal}
        userId={userId}
        challengedUserId={challengedUserId}
        challengedUserName={challengedUserName}
        challengedUserBalance={challengedUserBalance}
        userBalance={userBalance}
        mode="create"
        onChallengeCreated={() => {
          void loadLeaderboard(true)
          void loadBlockingChallenge()
        }}
      />
    </Dialog>
  )
}
