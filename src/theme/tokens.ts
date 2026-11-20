export type ThemeMode = 'classic' | 'modern' | 'light' | 'dark' | 'system';
export type ResolvedThemeMode = Exclude<ThemeMode, 'system'>;
export type ThemeColors = {
  background: string; surface: string; surfaceRaised: string; input: string;
  border: string; controlBorder: string; text: string; textSecondary: string; textMuted: string;
  accent: string; onAccent: string; danger: string; dangerSurface: string;
  warning: string; warningSurface: string; success: string; successSurface: string; overlay: string;
};
export type ThemeTokens = {
  id: ResolvedThemeMode; isDark: boolean; colors: ThemeColors;
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; section: number };
  radii: { card: number; control: number; pill: number };
  typography: Record<'hero' | 'title' | 'section' | 'body' | 'meta', { fontSize: number; lineHeight: number }>;
  metrics: { controlMinHeight: number; icon: number; screenGutter: number; cardPadding: number };
};

export const THEME_MODES: readonly ThemeMode[] = ['classic', 'modern', 'light', 'dark', 'system'];
export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && THEME_MODES.includes(value as ThemeMode);
}
export function resolveThemeMode(mode: ThemeMode, systemScheme: string | null | undefined): ResolvedThemeMode {
  if (!isThemeMode(mode)) throw new Error('Invalid appearance preference');
  return mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
}

const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, section: 24 };
const typography: ThemeTokens['typography'] = {
  hero: { fontSize: 30, lineHeight: 36 }, title: { fontSize: 24, lineHeight: 30 },
  section: { fontSize: 20, lineHeight: 28 }, body: { fontSize: 16, lineHeight: 24 },
  meta: { fontSize: 14, lineHeight: 20 },
};
const metrics = { controlMinHeight: 48, icon: 24, screenGutter: 20, cardPadding: 16 };
const darkSemantic = {
  danger: '#FFB4AB', dangerSurface: '#3B2024', warning: '#F5D58A', warningSurface: '#352C1B',
  success: '#A2DEB4', successSurface: '#193426', overlay: 'rgba(0,0,0,0.72)',
};
const colors: Record<ResolvedThemeMode, ThemeColors> = {
  classic: {
    background: '#0B0F14', surface: '#121820', surfaceRaised: '#1B2530', input: '#0E141B',
    border: '#344352', controlBorder: '#607282', text: '#F4F7FA', textSecondary: '#AAB5C0', textMuted: '#AAB5C0',
    accent: '#7DE2C3', onAccent: '#07100D', ...darkSemantic,
  },
  modern: {
    background: '#0C1018', surface: '#151D2B', surfaceRaised: '#202C3E', input: '#101724',
    border: '#3E5067', controlBorder: '#697D95', text: '#F3F6FC', textSecondary: '#B5C0D2', textMuted: '#B5C0D2',
    accent: '#B6C4FF', onAccent: '#152045', ...darkSemantic,
  },
  light: {
    background: '#F4F7F6', surface: '#FFFFFF', surfaceRaised: '#E4ECE8', input: '#EDF3F1',
    border: '#B7C8C1', controlBorder: '#758C84', text: '#152720', textSecondary: '#4E655C', textMuted: '#4E655C',
    accent: '#176B54', onAccent: '#FFFFFF', danger: '#9B2828', dangerSurface: '#FCE9E7',
    warning: '#71500B', warningSurface: '#FFF2CB', success: '#17663C', successSurface: '#E4F5E9',
    overlay: 'rgba(10,25,19,0.45)',
  },
  dark: {
    background: '#101A16', surface: '#19251F', surfaceRaised: '#25372D', input: '#122019',
    border: '#405B4B', controlBorder: '#698276', text: '#F1F7F3', textSecondary: '#B1C4B8', textMuted: '#B1C4B8',
    accent: '#8BDAB4', onAccent: '#092A1B', ...darkSemantic,
  },
};

/** All palettes are permanently free; there is deliberately no entitlement argument. */
export const THEMES: Record<ResolvedThemeMode, ThemeTokens> = Object.fromEntries(
  (['classic', 'modern', 'light', 'dark'] as const).map(id => [id, {
    id, isDark: id !== 'light', colors: colors[id], spacing, typography, metrics,
    radii: { card: id === 'classic' ? 20 : 16, control: id === 'classic' ? 14 : 12, pill: 999 },
  }]),
) as Record<ResolvedThemeMode, ThemeTokens>;
