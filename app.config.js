module.exports = ({ config }) => {
  const isPreview = process.env.APP_VARIANT === 'preview';
  const isGithubTest = process.env.APP_VARIANT === 'github-test';

  return {
    ...config,
    name: isGithubTest ? 'AI Memory GitHub Test' : isPreview ? 'AI Memory Preview' : config.name,
    android: {
      ...config.android,
      // Latest verified GitHub Test artifact: 0.1.0 / code 2 (run 44565432466).
      // B2 candidate 3 is strictly higher; installation still needs device checks.
      // Preserve the existing EAS Preview code and production code configuration.
      ...(isGithubTest ? { versionCode: 3 } : isPreview ? { versionCode: 2 } : {}),
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
