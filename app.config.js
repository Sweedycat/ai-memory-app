module.exports = ({ config }) => {
  const isPreview = process.env.APP_VARIANT === 'preview';
  const isGithubTest = process.env.APP_VARIANT === 'github-test';

  return {
    ...config,
    name: isGithubTest ? 'AI Memory GitHub Test' : isPreview ? 'AI Memory Preview' : config.name,
    android: {
      ...config.android,
      // The verified historical GitHub Test APK has versionCode 1.
      // Candidate 2 is strictly higher; installation still needs device checks.
      // Preserve the existing EAS Preview code and production code configuration.
      ...(isPreview || isGithubTest ? { versionCode: 2 } : {}),
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
