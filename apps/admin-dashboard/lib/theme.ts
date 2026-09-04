/**
 * White-Label Theme & Config System — Telecambios VE Platform
 * ----------------------------------------------------------
 * NEXT_PUBLIC_THEME controls visual style:
 *   - "telecambios-ve"   → Tema genérico (navy/violet/gold) — DEFAULT para nuevos clientes
 *   - "frank"   → Crypto-tech style (orange/amber)
 *   - "rafa"    → Emerald style (green/teal)
 *   - "jarvis"  → Crypto-hacker style (neon green/cyan) — JarvisP2P brand
 *
 * NEXT_PUBLIC_CLIENT_MODE controls feature visibility:
 *   - undefined   → Full mode (P2P + Community + Smart Index)
 *   - "p2p_only"  → Only P2P Command Center visible
 *
 * WHITE-LABEL CONFIG (configurable desde Admin Panel):
 *   - NEXT_PUBLIC_CLIENT_NAME  → Nombre de la plataforma (default: "Telecambios VE")
 *   - NEXT_PUBLIC_CLIENT_SLUG  → ID único del cliente para cookies (default: "telecambios-ve")
 *   - NEXT_PUBLIC_SUPPORT_EMAIL → Email de soporte (default: "soporte@telecambiosve.com")
 */

const themeEnv = process.env.NEXT_PUBLIC_THEME || 'telecambios-ve';
const KNOWN_THEMES = ['telecambios-ve', 'frank', 'rafa', 'jarvis'] as const;
type ThemeName = typeof KNOWN_THEMES[number];

export const THEME: ThemeName = KNOWN_THEMES.includes(themeEnv as any)
  ? (themeEnv as ThemeName)
  : 'telecambios-ve';

// --- Flags de tema ---
export const isTelecambiosVeTheme  = THEME === 'telecambios-ve';
export const isFrankTheme  = THEME === 'frank';
export const isRafaTheme   = THEME === 'rafa';
export const isJarvisTheme = THEME === 'jarvis';
export const isCustomTheme = THEME !== 'telecambios-ve';

// --- Modo de cliente ---
export const isP2POnly = process.env.NEXT_PUBLIC_CLIENT_MODE === 'p2p_only';

// --- Identidad White-Label ---
export const CLIENT_NAME    = process.env.NEXT_PUBLIC_CLIENT_NAME    || 'Telecambios VE';
export const CLIENT_SLUG    = process.env.NEXT_PUBLIC_CLIENT_SLUG    || 'telecambios-ve';
export const SUPPORT_EMAIL  = process.env.NEXT_PUBLIC_SUPPORT_EMAIL  || 'soporte@telecambiosve.com';
export const JWT_COOKIE_NAME = `${CLIENT_SLUG}_jwt`;

// --- Paleta de colores por tema (para componentes dinámicos) ---
export const THEME_COLORS = {
  'telecambios-ve': {
    primary:        '#7c3aed',
    primaryLight:   '#a78bfa',
    secondary:      '#d97706',
    secondaryLight: '#fbbf24',
    bg:             '#07090f',
    surface:        '#0d1117',
    border:         '#1a2035',
    glow:           'rgba(124,58,237,0.4)',
    gridLine:       'rgba(124,58,237,0.04)',
    selection:      'rgba(124,58,237,0.3)',
    gradient:       'from-violet-600 via-purple-500 to-indigo-600',
    gradientText:   'from-violet-400 via-purple-300 to-indigo-400',
    badgeBg:        'bg-violet-950/40',
    badgeBorder:    'border-violet-500/30',
    badgeText:      'text-violet-400',
    pingColor:      'bg-violet-400',
  },
  frank: {
    primary:        '#f97316',
    primaryLight:   '#fb923c',
    secondary:      '#eab308',
    secondaryLight: '#facc15',
    bg:             '#0a0a0a',
    surface:        '#111111',
    border:         '#1a1a1a',
    glow:           'rgba(251,146,60,0.4)',
    gridLine:       'rgba(251,146,60,0.03)',
    selection:      'rgba(251,146,60,0.3)',
    gradient:       'from-orange-500 via-amber-500 to-yellow-500',
    gradientText:   'from-orange-400 via-amber-400 to-yellow-400',
    badgeBg:        'bg-orange-950/40',
    badgeBorder:    'border-orange-500/30',
    badgeText:      'text-orange-400',
    pingColor:      'bg-orange-400',
  },
  rafa: {
    primary:        '#10b981',
    primaryLight:   '#34d399',
    secondary:      '#0891b2',
    secondaryLight: '#22d3ee',
    bg:             '#022c22',
    surface:        '#042f2e',
    border:         '#064e3b',
    glow:           'rgba(16,185,129,0.4)',
    gridLine:       'rgba(16,185,129,0.03)',
    selection:      'rgba(16,185,129,0.3)',
    gradient:       'from-emerald-500 via-teal-500 to-green-500',
    gradientText:   'from-emerald-400 via-teal-400 to-green-400',
    badgeBg:        'bg-emerald-950/40',
    badgeBorder:    'border-emerald-500/30',
    badgeText:      'text-emerald-400',
    pingColor:      'bg-emerald-400',
  },
  jarvis: {
    primary:        '#00ff41',
    primaryLight:   '#33ff66',
    secondary:      '#00d4ff',
    secondaryLight: '#33ddff',
    bg:             '#060611',
    surface:        '#0a0a1a',
    border:         '#1a1a3e',
    glow:           'rgba(0,255,65,0.4)',
    gridLine:       'rgba(0,255,65,0.04)',
    selection:      'rgba(0,255,65,0.3)',
    gradient:       'from-green-500 via-emerald-400 to-cyan-500',
    gradientText:   'from-green-400 via-emerald-300 to-cyan-400',
    badgeBg:        'bg-green-950/40',
    badgeBorder:    'border-green-500/30',
    badgeText:      'text-green-400',
    pingColor:      'bg-green-400',
  },
} as const;

export const C = THEME_COLORS[THEME];
