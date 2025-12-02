# Blackjack Pro - Strategy Learning Platform

A comprehensive blackjack strategy learning platform built with Next.js, featuring real-time game simulation, optimal move guidance, and progressive skill development through multiple learning modes.

## 🎯 Overview

Blackjack Pro is an educational web application designed to teach optimal blackjack strategy through interactive gameplay. Players can learn, practice, and master blackjack decision-making across three difficulty modes, with detailed feedback, statistics tracking, and a unique buyback drill system for skill reinforcement. Current table rules: H17 (dealer hits soft 17), DAS enabled, no doubling after split aces.

## ✨ Features

### Core Gameplay
- **Full Blackjack Simulation**: Complete game with dealer AI, card dealing, and hand evaluation
- **6-Deck Shoe**: Realistic casino-style gameplay with 6-deck shuffling
- **All Standard Actions**: Hit, Stand, Double Down, and Split pairs
- **Soft Hand Detection**: Proper handling of ace values and soft totals
- **Blackjack Detection**: Automatic recognition and 3:2 payout for natural blackjacks
- **Split Hand Management**: Full support for splitting pairs and playing multiple hands

### Learning Modes
1. **Learning Mode** 🎓
   - Shows optimal moves in real-time
   - Displays hints and explanations
   - Perfect for beginners learning basic strategy

2. **Practice Mode** 🎯
   - No hints during gameplay
   - Post-action feedback on move correctness
   - Detailed explanations for optimal vs. chosen moves

3. **Expert Mode** 🏆
   - No hints or feedback
   - Pure skill testing environment
   - Tracks accuracy and performance

### Progression System
- **Level System**: Gain XP and level up through gameplay
- **Experience Points**: Earned based on game outcomes and correct moves
- **Statistics Tracking**: Comprehensive stats per mode and overall
- **Win/Loss Tracking**: Detailed performance metrics
- **Accuracy Monitoring**: Track correct optimal moves vs. total moves

### Buyback Drill System
- **Escalating Mastery Drill**: Progressive difficulty tiers (5, 6, 7+ correct moves in a row)
- **Time-Limited Challenges**: 60-second timer for added pressure
- **Mistake Logging**: Detailed feedback on incorrect moves
- **Tier Progression**: Advance through difficulty levels
- **Reward System**: Earn buyback money ($250-$350) based on tier

### User Features
- **Authentication**: Email/password and OAuth (Google, Apple) sign-in
- **Persistent Progress**: All stats saved to database
- **Balance Management**: Virtual money system with betting controls
- **Round Summaries**: Periodic performance reviews every 30 rounds
- **Level Up Celebrations**: Animated level-up screens with achievements
- **Leaderboard & Rank**: Global/friends leaderboards with balance/level metrics, consistent tie-breakers, and rank chip/modal with loading states

### UI/UX
- **Responsive Design**: Mobile-first design with touch support
- **Dark Theme**: Modern dark interface optimized for extended play
- **Card Animations**: Smooth card dealing and transitions
- **Visual Feedback**: Color-coded results and hints
- **Swipe Navigation**: Touch gestures for split hand viewing

## 🛠️ Tech Stack

### Frontend
- **Next.js 16**: React framework with App Router
- **React 19**: UI library
- **TypeScript**: Type-safe development
- **Tailwind CSS 4**: Utility-first styling
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon library
- **Recharts**: Data visualization for statistics

### Backend & Database
- **Supabase**: Backend-as-a-Service
  - PostgreSQL database
  - Authentication (email, OAuth)
  - Row Level Security (RLS)
  - Real-time subscriptions

### Development Tools
- **pnpm**: Package manager
- **ESLint**: Code linting
- **PostCSS**: CSS processing
- **Vercel Analytics**: Performance monitoring

## 📋 Prerequisites

- **Node.js**: v18+ (recommended: v20+)
- **pnpm**: Latest version (`npm install -g pnpm`)
- **Supabase Account**: Free tier works fine
- **Git**: For version control

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd blackjack-pro
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: For OAuth redirects
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
```

### 4. Database Setup

Run the SQL migration scripts in your Supabase SQL Editor in order (see `scripts/` for the full list). Key leaderboard/rank migrations:
- `20241203000001_add_leaderboard_composite_indexes.sql`: composite indexes for leaderboard ordering.
- `20241203000002_add_leaderboard_rank_function.sql`: initial rank function.
- `20241203000003_enforce_unique_game_stats_user.sql`: unique constraint on `game_stats.user_id` and updated rank function (requires `user_profiles`).

### 5. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure (key files)

```
blackjack-pro/
├── app/                      # Next.js App Router (auth flows, entry, layout)
├── components/
│   ├── blackjack-game.tsx    # Main game UI and interactions
│   ├── betting-controls.tsx  # Bet controls
│   ├── buyback-drill-modal.tsx # Drill flow
│   ├── leaderboard-*.tsx     # Leaderboard chip/modal
│   ├── feedback-modal.tsx    # Feedback display
│   ├── playing-card.tsx      # Card visuals
│   └── ui/                   # Shadcn-based UI primitives
├── contexts/                 # Challenge/stat persistence contexts
├── hooks/
│   ├── use-game-engine.ts    # Per-hand engine state, actions, and dealer play
│   └── use-challenge-lifecycle.ts # Challenge timers/state
├── lib/
│   ├── strategy-config.ts    # Data-driven strategy matrix (H17/DAS, no split-ace doubles)
│   ├── blackjack-strategy.ts # Strategy resolver (actions/tips/feedback)
│   ├── hand-actions.ts       # Shared guards (canSplit/canDouble)
│   ├── game-engine.ts        # Dealer AI, resolution helpers, resolveHands
│   ├── card-utils.ts         # Deck, hand values, soft detection
│   ├── drill-feedback.ts     # Feedback generation
│   ├── settlement.ts         # Payout math (3:2 blackjack)
│   └── supabase/             # Supabase client/server helpers
├── docs/
│   └── blackjack-hand-feedback.md # H17 strategy/feedback reference (data-driven source)
├── scripts/                  # Database migration scripts
├── tests/                    # Vitest suites (engine, strategy, payouts)
├── middleware.ts             # Auth middleware
├── next.config.mjs           # Next.js config
├── package.json              # Scripts/deps
└── tsconfig.json             # TypeScript config
```

## 🎮 Key Features Explained

### Architecture and Module Map

- **Strategy (H17, DAS, no double on split aces)**
  - `lib/strategy-config.ts`: data-driven matrix for hard/soft/pair rules plus `tableRules` (H17 only; surrender-ready).
  - `lib/blackjack-strategy.ts`: resolves optimal move, tip, and feedback from the config; auto-injects “no double after drawing” copy.
  - `lib/hand-actions.ts`: shared guards (`canDouble`, `canSplit`, `isPairHand`) used by engine and UI for consistent permissions.
- **Engine and Resolution**
  - `hooks/use-game-engine.ts`: per-hand state machine (supports splits/DAS, blocks split-ace doubles) using shared helpers.
  - `lib/game-engine.ts`: dealer logic, dealing helpers, settlement helpers, and `resolveHands` (single/multi-hand payouts and XP).
  - `lib/settlement.ts`: payout math (3:2 blackjack, doubled wagers).
- **Feedback and Drills**
  - `lib/drill-feedback.ts`: feedback generation driven by strategy output; telemetry keys for drills.
  - `components/feedback-modal.tsx`, `components/buyback-drill-modal.tsx`: surfaces tips/why copy and drill flows.
- **UI**
  - `components/blackjack-game.tsx`: main UI, uses shared hand guards and engine actions; handles hints, practice feedback, and split navigation.
  - `components/playing-card.tsx`, `components/ui/*`: cards and UI primitives.
- **Docs**
  - `docs/blackjack-hand-feedback.md`: H17-only strategy/feedback reference sourced from `lib/strategy-config.ts`.

### Optimal Move Calculation

- Data-driven basic strategy (`lib/strategy-config.ts`) for hard/soft/pairs under H17/DAS (no double on split aces).
- Resolver (`lib/blackjack-strategy.ts`) outputs action, tip, feedback; doubles fall back when unavailable after draws.
- Shared permission checks (`lib/hand-actions.ts`) keep engine/UI in sync.

### Settlement System

Payouts are calculated using the `settlement.ts` module:
- **Blackjack**: 3:2 payout (2.5x base bet)
- **Regular Win**: 2x wager (1:1)
- **Push**: Return wager
- **Loss**: 0 return

Doubled bets are properly handled with 2x wager calculations.

### Buyback Drill System

The escalating mastery drill (`components/buyback-drill-modal.tsx`) challenges players to:
- Make consecutive correct moves (5, 6, 7+ based on tier)
- Complete within 60 seconds
- Avoid fast taps (<900ms) that don't count
- Learn from mistakes with detailed feedback

Rewards scale by tier:
- Tier 1: $250 (5 correct)
- Tier 2: $300 (6 correct)
- Tier 3+: $350 (7+ correct)

Tiers reset to Tier 1 after 24 hours have passed since the last successful drill completion.

### Statistics Tracking

The game tracks comprehensive statistics:
- **Overall**: Total hands, accuracy, win rate, winnings
- **Per Mode**: Separate stats for Learning, Practice, and Expert modes
- **Progression**: Level, XP, total winnings
- **Performance**: Correct moves, total moves, wins, losses

All stats persist to Supabase and sync across sessions.

## 🔧 Development

### Available Scripts

```bash
# Development server
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint
```

### Code Style

- TypeScript strict mode enabled
- ESLint for code quality
- Component-based architecture with shared hooks/helpers
- Data-driven strategy config and per-hand engine state

### Testing

- **Vitest suites**:
  - `tests/strategy-config.test.ts` — matrix spot-checks and double-availability messaging
  - `tests/use-game-engine-actions.test.ts` — engine actions, splits, doubles, bust paths
  - `tests/game-engine.test.ts` — dealer/settlement helpers and payouts
  - `tests/blackjack-payout.test.ts` — payout math and blackjack handling
- Run all tests: `pnpm test`

## 🗄️ Database Schema

### `user_profiles`
- `id` (UUID, Primary Key)
- `email` (Text)
- `display_name` (Text)
- `avatar_url` (Text)
- `created_at`, `updated_at` (Timestamps)

### `game_stats`
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key → user_profiles)
- `total_money` (Integer, default: 500)
- `total_winnings` (Integer, default: 0)
- `level` (Integer, default: 1)
- `experience` (Integer, default: 0)
- `drill_tier` (Integer, default: 0)
- `hands_played`, `correct_moves`, `total_moves` (Integers)
- `wins`, `losses`, `pushes` (Integers)
- Mode-specific stats (learning_*, practice_*, expert_*)
- `created_at`, `updated_at` (Timestamps)

## 🚢 Deployment

### Vercel (Recommended)

1. Push code to GitHub/GitLab
2. Import project in Vercel
3. Add environment variables
4. Deploy

The app is optimized for Vercel with:
- Edge runtime support
- Automatic builds
- Analytics integration

### Environment Variables for Production

Ensure all Supabase environment variables are set in your deployment platform.

## 🔒 Security

- **Row Level Security**: Database tables protected with RLS policies
- **Authentication**: Secure Supabase Auth with OAuth support
- **Middleware Protection**: Routes protected via Next.js middleware
- **Input Validation**: Type-safe operations throughout
- **No Sensitive Data**: All game data is user-specific and isolated

## 📊 Performance

- **Server Components**: Reduced client-side JavaScript
- **Code Splitting**: Automatic route-based splitting
- **Image Optimization**: Next.js Image component
- **Database Indexing**: Optimized queries with proper indexes
- **Caching**: Supabase client-side caching

## 🐛 Troubleshooting

### Common Issues

**Database connection errors**
- Verify Supabase URL and keys in `.env.local`
- Check RLS policies are correctly set up
- Ensure migrations have been run

**Authentication not working**
- Verify OAuth redirect URLs match your domain
- Check Supabase Auth settings
- Ensure callback route is accessible

**Stats not saving**
- Check browser console for errors
- Verify RLS policies allow updates
- Check network tab for failed requests

## 📝 License

[Add your license here]

## 🙏 Acknowledgments

- Basic strategy based on standard blackjack strategy charts
- UI components from shadcn/ui
- Icons from Lucide React

## 📧 Support

For issues, questions, or contributions, please open an issue on the repository.

---

**Built with ❤️ for learning optimal blackjack strategy**
