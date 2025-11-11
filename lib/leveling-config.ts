/**
 * Progressive Leveling System Configuration
 * 
 * Implements XP-indexed leveling with exponential difficulty curve
 * and cash bonuses that scale with progression difficulty.
 */

// Leveling formula constants
export const LEVELING_CONFIG = {
  // XP formula: ceil(A * L^alpha + B * L)
  A: 120,        // Base coefficient
  alpha: 1.6,    // Exponential factor
  B: 10,         // Linear coefficient
  
  // Cash bonus formula: max(MIN_BET, floor(r * XPNeeded(L)))
  r: 0.05,       // Bonus rate (tunable 0.03-0.07)
  MIN_BET: 50,   // Minimum cash bonus
  cash_cap: undefined as number | undefined, // Optional cap (unset by default)
  
  // XP awarded per win (base amount, scales with level)
  XP_PER_WIN_BASE: 10,
  
  // XP scaling formula: XP_PER_WIN_BASE * (1 + level * SCALING_FACTOR)
  // Alternative: use SCALING_EXPONENT for power scaling: XP_PER_WIN_BASE * level^SCALING_EXPONENT
  XP_SCALING_FACTOR: 0.1,  // Linear scaling: 10% increase per level
  // XP_SCALING_EXPONENT: 0.5,  // Square root scaling (uncomment to use instead)
  
  // Bet scaling for XP
  MIN_BET_AMOUNT: 5,  // Minimum bet amount (lowest chip value)
  BET_XP_SCALING: 0.02,  // XP multiplier per bet unit (2% per $1 above minimum)
} as const

/**
 * Calculate XP required to reach the next level
 * Formula: ceil(A * L^alpha + B * L)
 * 
 * @param level Current level (1-indexed)
 * @returns XP needed to level up from this level
 */
export function getXPNeeded(level: number): number {
  const { A, alpha, B } = LEVELING_CONFIG
  return Math.ceil(A * Math.pow(level, alpha) + B * level)
}

/**
 * Calculate cash bonus for completing a level
 * Formula: max(MIN_BET, floor(r * XPNeeded(L)))
 * 
 * @param level Level that was just completed (use level - 1 when leveling up)
 * @returns Cash bonus amount
 */
export function getCashBonus(level: number): number {
  const { r, MIN_BET } = LEVELING_CONFIG
  const xpNeeded = getXPNeeded(level)
  return Math.max(MIN_BET, Math.floor(r * xpNeeded))
}

/**
 * Calculate cash bonus with optional cap
 * 
 * @param level Level that was just completed
 * @param cap Optional maximum bonus amount
 * @returns Cash bonus amount (capped if cap is provided)
 */
export function getCashBonusWithCap(level: number, cap?: number): number {
  const bonus = getCashBonus(level)
  if (cap !== undefined) {
    return Math.min(bonus, cap)
  }
  return bonus
}

/**
 * Calculate XP awarded per win, scaled by level
 * Formula: XP_PER_WIN_BASE * (1 + level * XP_SCALING_FACTOR)
 * 
 * This ensures higher level players earn more XP per win, helping to balance
 * the exponentially increasing XP requirements.
 * 
 * Examples:
 * - Level 1: 10 * (1 + 1 * 0.1) = 11 XP
 * - Level 5: 10 * (1 + 5 * 0.1) = 15 XP
 * - Level 10: 10 * (1 + 10 * 0.1) = 20 XP
 * - Level 15: 10 * (1 + 15 * 0.1) = 25 XP
 * 
 * @param level Current level (1-indexed)
 * @returns XP awarded for a win at this level (base, without bet scaling)
 */
export function getXPPerWin(level: number): number {
  const { XP_PER_WIN_BASE, XP_SCALING_FACTOR } = LEVELING_CONFIG
  // Ensure minimum level of 1
  const safeLevel = Math.max(1, level)
  return Math.floor(XP_PER_WIN_BASE * (1 + safeLevel * XP_SCALING_FACTOR))
}

/**
 * Calculate XP awarded per win, scaled by level AND bet amount
 * Formula: getXPPerWin(level) * (1 + (betAmount - MIN_BET_AMOUNT) * BET_XP_SCALING)
 * 
 * Higher bets reward more XP, incentivizing riskier play.
 * 
 * Examples (at Level 1, base XP = 11):
 * - $5 bet: 11 * (1 + (5-5) * 0.02) = 11 XP
 * - $50 bet: 11 * (1 + (50-5) * 0.02) = 11 * 1.9 = 20.9 ≈ 20 XP
 * - $100 bet: 11 * (1 + (100-5) * 0.02) = 11 * 2.9 = 31.9 ≈ 31 XP
 * - $500 bet: 11 * (1 + (500-5) * 0.02) = 11 * 10.9 = 119.9 ≈ 119 XP
 * 
 * @param level Current level (1-indexed)
 * @param betAmount The bet amount placed for this win
 * @returns XP awarded for a win at this level with this bet
 */
export function getXPPerWinWithBet(level: number, betAmount: number): number {
  const baseXP = getXPPerWin(level)
  const { MIN_BET_AMOUNT, BET_XP_SCALING } = LEVELING_CONFIG
  
  // Ensure bet is at least minimum
  const safeBet = Math.max(MIN_BET_AMOUNT, betAmount)
  
  // Calculate bet multiplier: 1 + (bet - min_bet) * scaling_factor
  const betMultiplier = 1 + (safeBet - MIN_BET_AMOUNT) * BET_XP_SCALING
  
  return Math.floor(baseXP * betMultiplier)
}

/**
 * Verify leveling calculations with expected values
 * L=1 → XPNeeded=130, CashBonus=$50
 * L=4 → XPNeeded=1143, CashBonus=$57
 * L=10 → XPNeeded=4878, CashBonus=$243
 */
export function verifyLevelingCalculations(): boolean {
  const l1_xp = getXPNeeded(1)
  const l1_bonus = getCashBonus(1)
  const l4_xp = getXPNeeded(4)
  const l4_bonus = getCashBonus(4)
  const l10_xp = getXPNeeded(10)
  const l10_bonus = getCashBonus(10)
  
  const valid = 
    l1_xp === 130 && l1_bonus === 50 &&
    l4_xp === 1143 && l4_bonus === 57 &&
    l10_xp === 4878 && l10_bonus === 243
  
  if (!valid) {
    console.warn('Leveling calculations mismatch:', {
      'L1': { xp: l1_xp, bonus: l1_bonus, expected: { xp: 130, bonus: 50 } },
      'L4': { xp: l4_xp, bonus: l4_bonus, expected: { xp: 1143, bonus: 57 } },
      'L10': { xp: l10_xp, bonus: l10_bonus, expected: { xp: 4878, bonus: 243 } },
    })
  }
  
  return valid
}

