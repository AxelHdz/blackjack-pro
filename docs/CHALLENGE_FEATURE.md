# Challenge Feature Documentation

## Overview

The Challenge feature allows users to compete against each other in timed blackjack competitions. Users can challenge other players from the leaderboard, set wager amounts, and compete to see who can earn the most money during a specified time period while playing in Expert mode. Once a challenge starts both players receive 500 gold **challenge credits** (their normal balances are paused), all gameplay uses those credits exclusively, and every hand awards **2x XP** that is applied when the challenge ends.

## User Flows

### Creating a Challenge

1. User opens the leaderboard from the main game interface
   - Challenge buttons are automatically disabled if the user already has a pending or active challenge; they must cancel or complete it first
2. User clicks the "Challenge" button (swords icon) next to another player's name
3. Challenge modal opens with:
   - Wager amount input (must not exceed either player's balance)
   - Duration selection (5 or 10 minutes)
   - "Max Wager" button to set wager to the maximum allowed
4. User clicks "Request Challenge"
5. Wager is deducted from challenger's balance
6. Challenge status is set to "pending"

### Receiving a Challenge

1. Challenged user sees a "Challenge Received" chip below the leaderboard chip with a "New" badge
   - The leaderboard/challenge chip polls `/api/challenges` every 10 seconds so this badge appears even if the player opens the game after the request was sent
2. User clicks the challenge chip to open the challenge modal
3. Modal displays:
   - Challenge details (wager, duration) in read-only format
   - "Accept Challenge" button (primary action)
   - "Request Changes" button (secondary action)
   - Information about Expert mode requirement
   - Callout describing the 500 gold challenge credits and 2x XP boost that will be applied at completion
4. User can either:
   - Accept the challenge as-is
   - Click "Request Changes" to propose different terms

### Requesting Changes (Counter-Offer)

1. Challenged user clicks "Request Changes" button
2. Modal switches to counter-offer mode with editable fields:
   - Wager amount (pre-filled with current challenge values)
   - Duration (5 or 10 minutes, pre-filled)
3. User modifies terms and clicks "Request Update"
4. Challenge status remains "pending" but terms are updated
5. Original challenger now sees the updated challenge and can accept or decline

### Accepting a Challenge

1. When a challenge is accepted:
   - Challenge status changes to "active"
   - Each player is granted **500 gold challenge credits** and their normal balance is paused (wagers remain escrowed)
   - Timer starts (5 or 10 minutes based on challenge settings)
   - Both players are restricted to Expert mode only
   - XP earned during the challenge is **doubled**, but the boost is applied only when the challenge ends
2. During the challenge:
   - The Challenge Chip shows whether you are winning/losing, the credit delta, and a live countdown
   - Tapping the chip (or opening the modal from the leaderboard) displays both players' challenge credits and remaining time
   - All other game modes (Learning, Practice) are disabled
   - Only Expert mode games count toward challenge results
   - The main game HUD replaces the balance display with the gold challenge credits (swords icon) and adds a centered countdown between bet and card counter
   - Buyback drills award challenge credits instead of normal funds
   - Credits are synchronized by a progress endpoint so both sides stay up to date

### Challenge Completion

1. When timer expires:
   - Challenge automatically completes and freezes the final challenge credits
   - Winner is determined by the higher challenge credit balance (ties occur when credits match)
   - The stored wager is transferred to the winner (or refunded to both players on a tie)
   - Each player's accumulated double XP is applied to their normal profile, triggering level-ups and cash bonuses as usual
   - Challenge status changes to "completed"
2. Challenge chip updates to show:
   - Money icon (green) for winner
   - X icon (red) for loser
   - Check icon for tie
   - Final credit delta when reopening the modal
3. User can click chip to view challenge results, including both credit balances and XP earned

### Pending Challenge (Outgoing)

1. When a user sends a challenge that hasn't been accepted:
   - User sees "Pending Challenge" chip below leaderboard
   - Chip displays opponent's name
   - No "New" badge (only incoming challenges show this)
2. User can click chip to view challenge details

## Challenge States

### Pending (Incoming)
- User was challenged by another player
- Display: "Challenge Received" with red "New" badge
- User can accept or request changes

### Pending (Outgoing)
- User sent a challenge that hasn't been accepted
- Display: "Pending Challenge" with opponent's name
- User can view challenge details

### Active
- Challenge has been accepted and timer is running
- Display: chip shows winning/losing state, credit delta, and countdown
- Both players restricted to Expert mode
- Main game UI swaps the balance display for gold challenge credits (with swords icon) and shows a center-aligned countdown between bet and card count indicators
- Challenge credits are synchronized via the progress API so both players stay up-to-date

### Completed
- Challenge timer has expired and winner determined
- Display: Money icon (win), X icon (loss), or Check icon (tie)
- Modal shows both final credit balances, XP earned (2x boost), and the usual wager outcome

### Cancelled
- Challenger withdrew the request before it was accepted
- Display: Challenge chip shows "Challenge Cancelled" plus a refunded badge so the challenger knows their wager returned
- Modal highlights that the wager has already been refunded and keeps the challenge available for review/history

## Database Schema

### Challenges Table

```sql
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenged_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wager_amount INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (5, 10)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  challenger_balance_start INTEGER,
  challenged_balance_start INTEGER,
  challenger_balance_end INTEGER,
  challenged_balance_end INTEGER,
  challenger_balance_paused INTEGER,
  challenged_balance_paused INTEGER,
  challenger_credit_balance INTEGER,
  challenged_credit_balance INTEGER,
  challenger_credit_experience INTEGER DEFAULT 0,
  challenged_credit_experience INTEGER DEFAULT 0,
  winner_id UUID REFERENCES auth.users(id),
  started_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Challenge credit fields**
- `challenger_balance_paused` / `challenged_balance_paused`: snapshots of each user's real balance while challenge credits are active
- `challenger_credit_balance` / `challenged_credit_balance`: current gold challenge credits (start at 500 for both players)
- `challenger_credit_experience` / `challenged_credit_experience`: accumulated double XP awaiting payout when the challenge completes

### Constraints

- Only one active or pending challenge per user (enforced by unique partial indexes)
- Duration must be 5 or 10 minutes
- Status must be one of: pending, active, completed, cancelled

### Row Level Security (RLS) Policies

- Users can view challenges where they are challenger or challenged
- Users can create challenges where they are the challenger
- Users can update challenges where they are challenger (pending only) or challenged (accept/counter-offer)
- Users can delete challenges where they are challenger and status is pending

## API Endpoints

### GET `/api/challenges`

Fetches challenges for the current user.

**Query Parameters:**
- `status` (optional): Filter by status ('pending', 'active', 'pending,active', or null for all)

**Response:**
```json
{
  "challenges": [
    {
      "id": "uuid",
      "challengerId": "uuid",
      "challengerName": "string",
      "challengedId": "uuid",
      "challengedName": "string",
      "wagerAmount": 1000,
      "durationMinutes": 5,
      "status": "pending",
      "expiresAt": "timestamp",
      "startedAt": "timestamp",
      "winnerId": "uuid",
      "challengerCreditBalance": 500,
      "challengedCreditBalance": 500,
      "challengerCreditExperience": 0,
      "challengedCreditExperience": 0,
      "awaitingUserId": "uuid"
    }
  ]
}
```

### POST `/api/challenges`

Creates a new challenge.

**Request Body:**
```json
{
  "challengedId": "uuid",
  "wagerAmount": 1000,
  "durationMinutes": 5
}
```

**Validation:**
- Challenger must have sufficient balance
- Challenged user must have sufficient balance
- User cannot challenge themselves
- No existing active/pending challenges for either user

**Response:**
```json
{
  "challenge": {
    "id": "uuid",
    ...
  }
}
```

### GET `/api/challenges/[id]`

Fetches a specific challenge by ID.

**Response:**
```json
{
  "id": "uuid",
  "challengerId": "uuid",
  "challengerName": "string",
  "challengerCreditBalance": 500,
  "challengedCreditBalance": 500,
  "challengerCreditExperience": 0,
  "challengedCreditExperience": 0,
  "awaitingUserId": "uuid",
  ...
}
```

### PUT `/api/challenges/[id]`

Updates a challenge (accept or counter-offer).

**Request Body (Accept):**
```json
{
  "action": "accept"
}
```

**Request Body (Counter-Offer):**
```json
{
  "action": "counter-offer",
  "wagerAmount": 1500,
  "durationMinutes": 10
}
```

**Response:**
```json
{
  "challenge": {
    "id": "uuid",
    ...
  }
}
```

### DELETE `/api/challenges/[id]`

Cancels a pending challenge, refunds the wager to the challenger, and persists the row with `status: "cancelled"` so the UI can continue to show the outcome.

**Response:**
```json
{
  "challenge": {
    "id": "uuid",
    "status": "cancelled",
    ...
  }
}
```

### POST `/api/challenges/[id]/complete`

Completes a challenge (called automatically when timer expires).

**Response:**
```json
{
  "challenge": {
    "id": "uuid",
    "status": "completed",
    "winnerId": "uuid",
    ...
  }
}
```

### GET `/api/challenges/active`

Fetches the current user's active challenge (if any).

**Response:**
```json
{
  "challenge": {
    "id": "uuid",
    "status": "active",
    ...
  }
}
```

## Components

### ChallengeChip

Displays challenge status below the leaderboard chip.

**Props:**
- `challenge`: Challenge object or null
- `onClick`: Function to handle chip click
- `userId`: Current user's ID

**Features:**
- Shows different states: pending (incoming/outgoing), active, completed
- Displays "Challenge Cancelled" with a refunded badge when the challenger backs out so players understand their credits were restored
- Refreshed via a 10-second poll so the chip appears/updates even if the user was away when the challenge state changed
- Displays countdown timer for active challenges plus a live credit delta that highlights whether the user is winning or losing
- Shows opponent name for outgoing pending challenges
- Displays win/loss icons for completed challenges and opens the modal with final credit balances and XP info

### ChallengeModal

Modal for creating, accepting, and counter-offering challenges.

**Props:**
- `open`: Boolean to control modal visibility
- `onOpenChange`: Function to handle open state changes
- `challengedUserId`: ID of user being challenged (for create mode)
- `challengedUserName`: Name of user being challenged
- `challengedUserBalance`: Balance of user being challenged
- `challenge`: Existing challenge object (for accept/counter modes)
- `mode`: 'create' | 'accept' | 'counter'
- `userBalance`: Current user's balance
- `onChallengeCreated`: Callback when challenge is created
- `onChallengeUpdated`: Callback when challenge is updated

**Modes:**
- **Create**: Shows wager input, duration selection, and "Request Challenge" button
- **Accept**: Shows read-only challenge details, a callout that highlights the 500 gold credits + 2x XP boost, "Accept Challenge" button, and "Request Changes" button
- **Counter**: Shows editable wager and duration fields, "Request Update" button
- **View (Active)**: Displays both players' challenge credits, a live countdown badge, and the current credit delta
- **Status Banners**: Every non-create view renders a contextual banner (pending, active, completed, cancelled) so the user instantly knows whether they must take action or are simply reviewing history

### LeaderboardChip

Modified to display ChallengeChip below the leaderboard button.

**Features:**
- Fetches and prioritizes challenges (active > incoming pending > outgoing pending)
- Polls challenge data every 10 seconds so players are notified when a pending challenge flips states or a new one arrives
- Opens ChallengeModal when challenge chip is clicked
- Passes appropriate mode based on challenge status and user role

### LeaderboardModal

Modified to include challenge functionality.

**Features:**
- "Challenge" button with swords icon next to each user (except current user)
- Button includes "Challenge" text and white outline styling
- Opens ChallengeModal with challenged user details
- Fetches user balance for validation
- Disables challenge buttons (and surfaces a helper message) whenever the user already has a pending or active challenge

### BlackjackGame

Modified to enforce Expert mode during active challenges.

**Features:**
- Fetches active challenge on mount and forces Expert mode while one is active
- Disables Learning and Practice modes when challenge is active
- Replaces the balance display with gold challenge credits (swords icon) and adds a center-aligned countdown between bet amount and card count overlays
- Syncs challenge credits and double XP via `/api/challenges/[id]/progress`, pausing normal stat persistence until the challenge ends
- Buyback drills add challenge credits instead of cash whenever a challenge is active
- Polls for challenge completion every 30 seconds and applies deferred XP/bonuses when the challenge finishes

## Business Rules

1. **Single Active Challenge**: Users can only have one active or pending challenge at a time (challenge buttons are disabled until they cancel/complete)
2. **Balance Validation**: Wager cannot exceed either player's balance
3. **Expert Mode Only**: During active challenges, only Expert mode is available
4. **Automatic Completion**: Challenges automatically complete when the timer expires
5. **Challenge Credits**: Upon acceptance, both players receive 500 gold challenge credits while their normal balances are paused; buyback drills add credits instead of cash
6. **XP Boost**: Hands played during a challenge grant 2x XP, but the XP (and any resulting level-ups/cash bonuses) is applied once the challenge completes
7. **Progress Sync**: Clients must periodically sync their credit balance and XP delta via `/api/challenges/[id]/progress`
8. **Wager Transfer**: Winner receives the wager amount from the loser (or both are refunded on a tie)
9. **Counter-Offers**: Challenged users can propose different terms, creating a new pending challenge for the challenger to accept

## Technical Implementation Details

### Challenge Prioritization

The system prioritizes challenges in the following order:
1. Active challenges (highest priority)
2. Pending challenges where user is challenged (incoming)
3. Pending challenges where user is challenger (outgoing)

### Challenge Credit Tracking

When a challenge is accepted:
- `challenger_balance_paused` and `challenged_balance_paused` capture each user's real balance while the challenge credits are active
- `challenger_credit_balance` and `challenged_credit_balance` start at 500 and represent the live gold credits shown in the UI
- Clients call `/api/challenges/[id]/progress` to sync their credit balance and double XP delta so the server has authoritative data

When a challenge completes:
- Winner is determined by comparing the final credit balances (tie if equal)
- `challenger_balance_end` / `challenged_balance_end` store the post-payout real balances
- `challenger_credit_experience` / `challenged_credit_experience` are used to apply deferred XP, level-ups, and cash bonuses to `game_stats`

### Timer Management

- Challenges use `expires_at` timestamp calculated from `started_at + duration_minutes`
- Client-side polling checks for completion every 30 seconds
- Server-side completion endpoint is called automatically when timer expires

### Challenge Status Flow

```
pending → active → completed
   ↓
cancelled (if challenger cancels before acceptance)
```

## Error Handling

### Common Errors

1. **Insufficient Balance**: User doesn't have enough balance to cover wager
2. **Existing Challenge**: User already has an active or pending challenge
3. **Self-Challenge**: User attempts to challenge themselves
4. **Invalid Wager**: Wager exceeds challenged user's balance

### Error Messages

All errors are displayed via toast notifications with descriptive messages guiding users on how to resolve the issue.

## Future Enhancements

Potential improvements for the challenge feature:

1. Real-time challenge updates using Supabase realtime subscriptions
2. Challenge history view showing past challenges
3. Challenge statistics (win/loss record, total winnings)
4. Challenge notifications for incoming challenges
5. Challenge expiration for pending challenges (auto-cancel after X hours)
6. Challenge spectating (view active challenges between other players)
7. Challenge leaderboards (top challengers, highest wagers, etc.)
### POST `/api/challenges/[id]/progress`

Updates the caller's challenge credits and/or the accumulated double XP buffer while a challenge is active.

**Request Body:**
```json
{
  "creditBalance": 472,
  "xpDelta": 24
}
```

- `creditBalance` (optional): absolute gold credit balance from the client
- `xpDelta` (optional): incremental XP (already doubled) earned since the last sync

**Response:**
```json
{
  "challenge": {
    "id": "uuid",
    "challengerCreditBalance": 472,
    "challengedCreditBalance": 510,
    "challengerCreditExperience": 120,
    "challengedCreditExperience": 140,
    ...
  }
}
```
