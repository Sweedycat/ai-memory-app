module.exports = ({ config }) => {
  const isPreview = process.env.APP_VARIANT === 'preview';
  const isGithubTest = process.env.APP_VARIANT === 'github-test';

  return {
    ...config,
    name: isGithubTest ? 'AI Memory GitHub Test' : isPreview ? 'AI Memory Preview' : config.name,
    android: {
      ...config.android,
      // Latest verified GitHub Test artifact: 0.0.4-dev / code 4 (run 44874930574).
      // Privacy-load repair candidate 5 is strictly higher; installed identity remains unverified.
      // Preserve the existing EAS Preview code and production code configuration.
      ...(isGithubTest ? { versionCode: 5 } : isPreview ? { versionCode: 2 } : {}),
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
