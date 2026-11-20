import { featuresEn, featuresTr } from './features';
import { gatesEn, gatesTr } from './gates';
import { settingsEn, settingsTr } from './settings';

export const uiEn = { ...featuresEn, gates: gatesEn, settings: settingsEn };
export const uiTr: typeof uiEn = { ...featuresTr, gates: gatesTr, settings: settingsTr };
