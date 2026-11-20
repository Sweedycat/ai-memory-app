import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

/** Use once at a standalone screen boundary, never around an already inset child. */
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}>
    {children}
  </SafeAreaView>;
}
