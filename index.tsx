import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';
import { OwnerProfileGate } from './src/components/OwnerProfileGate';
import { PrivacyGate } from './src/components/PrivacyGate';

function Root() {
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'android' ? 'height' : undefined}
    >
      <PrivacyGate>
        <OwnerProfileGate>
          <App />
        </OwnerProfileGate>
      </PrivacyGate>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

registerRootComponent(Root);
