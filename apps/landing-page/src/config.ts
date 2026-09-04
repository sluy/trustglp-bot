/**
 * JarvisP2P Landing Page — Config
 * ────────────────────────────────
 * Centralized configuration for external URLs and env-dependent values.
 */

// The base URL for the demo instance of the admin-dashboard.
// In production: https://demo.jarvisp2p.com
// In dev: http://localhost:3000 (the admin-dashboard Next.js dev server)
export const DEMO_BASE_URL = import.meta.env.VITE_DEMO_BASE_URL || 'https://demo.jarvisp2p.com';

// Calendly booking URL
export const CALENDLY_URL = import.meta.env.VITE_CALENDLY_URL || 'https://calendly.com/pagoscreatuimperiodigital/automatiza-tu-p2p';

/**
 * Get the demo URL for a specific tier.
 * The admin-dashboard reads ?tier= from the URL to control module visibility.
 */
export function getDemoUrl(tier: 'starter' | 'growth' | 'enterprise'): string {
  return `${DEMO_BASE_URL}?tier=${tier}`;
}
