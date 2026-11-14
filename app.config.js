module.exports = ({ config }) => {
  const isPreview = process.env.APP_VARIANT === 'preview';
  const isGithubTest = process.env.APP_VARIANT === 'github-test';

  return {
    ...config,
    name: isGithubTest ? 'AI Memory GitHub Test' : isPreview ? 'AI Memory Preview' : config.name,
    android: {
      ...config.android,
      // Preview 0.0.2 replaces the previous Preview 0.1.0 (versionCode 1).
      // Keep production configuration unchanged; never lower Android versionCode.
      ...(isPreview ? { versionCode: 2 } : {}),
      package: isGithubTest
        ? 'com.sweedycat.aimemory.githubtest'
        : isPreview ? 'com.sweedycat.aimemory.preview' : config.android?.package,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: isGithubTest
        ? 'com.sweedycat.aimemory.githubtest'
        : isPreview ? 'com.sweedycat.aimemory.preview' : config.ios?.bundleIdentifier,
    },
  };
};
