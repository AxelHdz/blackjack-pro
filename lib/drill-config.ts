export const DRILL_CONFIG = {
  enabled: true,
  min_bet: 50,
  reward_base_multiplier: 5, // 5 × $50 = $250
  reward_step_multiplier: 1, // 1 × $50 = $50
  tiers: [5, 6, 7], // Streak requirements
  unlimited_attempts: true,
  unlimited_clears: true,
  cooldown_busts_after_clear: 0,
  fast_tap_ms: 800,
  allow_hints: false,
  count_all_correct: true,
  rules: {
    include_surrender: false,
    table_variant: "S17" as "S17" | "H17",
  },
} as const

export function getReward(tierIndex: number): number {
  const base = DRILL_CONFIG.min_bet * DRILL_CONFIG.reward_base_multiplier
  const step = DRILL_CONFIG.min_bet * DRILL_CONFIG.reward_step_multiplier

  if (tierIndex === 0) return base // Tier 1: $250
  if (tierIndex === 1) return base + step // Tier 2: $300
  return base + 2 * step // Tier 3+: $350
}

export function getStreakRequired(tierIndex: number): number {
  return DRILL_CONFIG.tiers[Math.min(tierIndex, DRILL_CONFIG.tiers.length - 1)]
}
