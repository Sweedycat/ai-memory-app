import React from 'react';
import { KeyboardAvoidingView, Platform, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
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
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.root}>
        {/* Clip the viewport, not just scroll content: overscroll must stay inside system bars. */}
        <View style={styles.viewport}>
          <PrivacyGate>
            <OwnerProfileGate>
              <NotebookBoundary><App /></NotebookBoundary>
            </OwnerProfileGate>
          </PrivacyGate>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  viewport: { flex: 1, overflow: 'hidden' },
});

registerRootComponent(Root);
