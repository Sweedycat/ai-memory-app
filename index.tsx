import React from 'react';
import { registerRootComponent } from 'expo';

import App from './App';
import { OwnerProfileGate } from './src/components/OwnerProfileGate';
import { PrivacyGate } from './src/components/PrivacyGate';

function Root() {
  return (
    <PrivacyGate>
      <OwnerProfileGate>
        <App />
      </OwnerProfileGate>
    </PrivacyGate>
  );
}

registerRootComponent(Root);
