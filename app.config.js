module.exports = ({ config }) => {
  const isPreview = process.env.APP_VARIANT === 'preview';
  const isGithubTest = process.env.APP_VARIANT === 'github-test';

  return {
    ...config,
    name: isGithubTest ? 'AI Memory GitHub Test' : isPreview ? 'AI Memory Preview' : config.name,
    android: {
      ...config.android,
      // Latest verified GitHub Test artifact: 0.2.0 / code 3 (run 44670257253).
      // Corrected B2 candidate 4 is strictly higher; installed identity remains unverified.
      // Preserve the existing EAS Preview code and production code configuration.
      ...(isGithubTest ? { versionCode: 4 } : isPreview ? { versionCode: 2 } : {}),
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
