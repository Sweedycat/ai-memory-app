// Execute the real navigation hook. Only native presentation/event delivery is
// simulated; save/discard callbacks, storage and failure results stay real.
function bindNavigation(load, react, native, i18n) {
  const alerts = [], backs = new Set();
  if (!react.useCallback) react.useCallback = (callback, deps) => react.useMemo(() => callback, deps);
  const originalAlert = native.Alert?.alert;
  native.Alert = { ...native.Alert, alert(title, message, buttons, options) {
    alerts.push({ title, message, buttons, options });
    originalAlert?.(title, message, buttons, options);
  } };
  const originalAdd = native.BackHandler?.addEventListener;
  native.BackHandler = { exitApp() {}, ...native.BackHandler,
    addEventListener(name, callback) {
      backs.add(callback);
      const subscription = originalAdd?.(name, callback);
      return { remove() { backs.delete(callback); subscription?.remove(); } };
    },
  };
  const module = load('src/hooks/useUnsavedChanges.ts', {
    react: { ...react }, 'react-native': native, '../i18n/LanguageProvider': i18n,
  });
  return { module, alerts, backs };
}
module.exports = { bindNavigation };
