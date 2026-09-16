/**
 * Compatibility layer for TaskJuggler III Ruby → TypeScript port
 * 
 * This module provides the `compat.keepRubyBugs` flag and helper functions
 * needed to maintain behavioral parity with the original Ruby implementation.
 * 
 * The flag controls whether to replicate known bugs (Category B) or apply
 * corrected behavior. Category A bugs are always fixed, Category C bugs
 * are always replicated.
 */

/**
 * Global compatibility flag.
 * 
 * When `true` (default), the port replicates known bugs from the original
 * TaskJuggler III Ruby implementation to ensure behavioral parity.
 * 
 * When `false`, the port applies corrected behavior for bugs that would
 * otherwise cause divergence from the original implementation.
 * 
 * Category A bugs are always fixed regardless of this flag.
 * Category C bugs are always replicated regardless of this flag.
 * Category B bugs are controlled by this flag.
 */
export const compat = {
  /**
   * When true, replicate Ruby bugs (Category B) for behavioral parity.
   * When false, apply corrected behavior.
   */
  keepRubyBugs: true,
};

/**
 * Ruby-compatible round function for negative numbers.
 * 
 * Ruby's Integer#round uses half-away-from-zero rounding:
 * -2.5.round == -3 (rounds away from zero)
 * 2.5.round == 3 (rounds away from zero)
 * 
 * JavaScript's Math.round uses half-up rounding:
 * -2.5.round == -2 (rounds toward zero)
 * 2.5.round == 3 (rounds away from zero)
 * 
 * This function provides Ruby's rounding behavior when compat.keepRubyBugs is true.
 */
export function rubyRound(n: number): number {
  if (!compat.keepRubyBugs) {
    return Math.round(n);
  }
  
  // Ruby's half-away-from-zero rounding
  if (n >= 0) {
    return Math.floor(n + 0.5);
  } else {
    return Math.ceil(n - 0.5);
  }
}