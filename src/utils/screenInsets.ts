import { Platform, StatusBar } from 'react-native';

/**
 * React Native SafeAreaView does not apply Android status-bar insets.
 * Keep a small visual gap below the status bar, so top back/navigation
 * controls remain readable and tappable on Samsung and other devices.
 */
export const SCREEN_TOP_PADDING =
  Platform.OS === 'android'
    ? Math.max(StatusBar.currentHeight ?? 24, 24) + 12
    : 20;
