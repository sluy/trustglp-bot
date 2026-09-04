/**
 * Demo Mode Helper — JarvisP2P
 * ─────────────────────────────
 * Detects demo mode from env var and reads tier from URL query params.
 * 
 * ENV: NEXT_PUBLIC_DEMO_MODE=true
 * URL: ?tier=starter | ?tier=growth | ?tier=enterprise
 * 
 * Tier visibility:
 *   - starter:    P2P Command Center + Operadores
 *   - growth:     + Radar Inteligente
 *   - enterprise: + Auto-Pay Bot + Config (todo)
 */

export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
export const CALENDLY_URL = 'https://calendly.com/pagoscreatuimperiodigital/automatiza-tu-p2p';

export type DemoTier = 'starter' | 'growth' | 'enterprise';

/**
 * Read demo tier from URL search params (client-side only).
 * Falls back to 'enterprise' if not specified.
 */
export function getDemoTier(): DemoTier {
  if (typeof window === 'undefined') return 'enterprise';
  const params = new URLSearchParams(window.location.search);
  const tier = params.get('tier');
  if (tier === 'starter' || tier === 'growth' || tier === 'enterprise') return tier;
  return 'enterprise';
}

/**
 * Check if a nav module should be visible for the current demo tier.
 */
export function isDemoModuleVisible(module: 'p2p' | 'radar' | 'autopay' | 'operadores' | 'config', tier: DemoTier): boolean {
  switch (module) {
    case 'p2p':
    case 'operadores':
      return true; // Always visible in all tiers
    case 'radar':
      return tier === 'growth' || tier === 'enterprise';
    case 'autopay':
    case 'config':
      return tier === 'enterprise';
    default:
      return true;
  }
}

/**
 * Human-readable tier labels
 */
export function getTierLabel(tier: DemoTier): string {
  switch (tier) {
    case 'starter': return 'Starter';
    case 'growth': return 'Growth';
    case 'enterprise': return 'Enterprise';
  }
}
