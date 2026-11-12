module.exports = ({ config }) => {
  const isPreview = process.env.APP_VARIANT === 'preview';

  return {
    ...config,
    name: isPreview ? 'AI Memory Preview' : config.name,
    android: {
      ...config.android,
      // Preview 0.0.2 replaces the previous Preview 0.1.0 (versionCode 1).
      // Keep production configuration unchanged; never lower Android versionCode.
      ...(isPreview ? { versionCode: 2 } : {}),
      package: isPreview
        ? 'com.sweedycat.aimemory.preview'
        : config.android?.package,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: isPreview
        ? 'com.sweedycat.aimemory.preview'
        : config.ios?.bundleIdentifier,
    },
  };
};
