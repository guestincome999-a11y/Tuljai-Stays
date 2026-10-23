const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo's on-demand filesystem resolves workspace imports lazily. Keeping the
// initial watch scope local avoids Windows timing out while subscribing to
// every workspace and the root node_modules directory.
config.watchFolders = [__dirname];

module.exports = config;
