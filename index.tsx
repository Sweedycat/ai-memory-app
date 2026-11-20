import React from 'react';
import { KeyboardAvoidingView, Platform, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerRootComponent } from 'expo';

import App from './App';
import { OwnerProfileGate } from './src/components/OwnerProfileGate';
import { PrivacyGate } from './src/components/PrivacyGate';
import { NotebookBoundary } from './src/components/NotebookBoundary';
import { LanguageProvider } from './src/i18n/LanguageProvider';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

function Root() {
  return <SafeAreaProvider><LanguageProvider><ThemeProvider><RootContent /></ThemeProvider></LanguageProvider></SafeAreaProvider>;
}

function RootContent() {
  const { theme, isDark } = useTheme();
  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'android' ? 'height' : undefined}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <PrivacyGate>
        <OwnerProfileGate>
          <NotebookBoundary><App /></NotebookBoundary>
        </OwnerProfileGate>
      </PrivacyGate>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

registerRootComponent(Root);
