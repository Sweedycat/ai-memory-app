module.exports = ({ config }) => {
  const isPreview = process.env.APP_VARIANT === 'preview';

  return {
    ...config,
    name: isPreview ? 'AI Memory Preview' : config.name,
    android: {
      ...config.android,
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
