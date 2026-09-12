import React from 'react';
import { registerRootComponent } from 'expo';

import App from './App';
import { PrivacyGate } from './src/components/PrivacyGate';

function Root() {
  return (
    <PrivacyGate>
      <App />
    </PrivacyGate>
  );
}

registerRootComponent(Root);
