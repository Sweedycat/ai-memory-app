import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

/** Screen inside the shared root safe viewport. Native modals need their own safe boundary. */
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return <SafeAreaView edges={[]} style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}>
    {children}
  </SafeAreaView>;
}
