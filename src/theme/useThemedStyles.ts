import { useMemo } from 'react';
import { useTheme } from './ThemeProvider';
import type { ThemeTokens } from './tokens';

/** One style factory per component; a palette change never keys/remounts screens. */
export function useThemedStyles<T>(create: (theme: ThemeTokens) => T): T {
  const { theme } = useTheme();
  return useMemo(() => create(theme), [create, theme]);
}
