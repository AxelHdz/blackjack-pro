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
  
  // XP awarded per win
  XP_PER_WIN: 10,
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

