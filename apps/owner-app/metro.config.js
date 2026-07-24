const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Expo resolves workspace imports on demand. Restricting the initial watch
// scope to this app prevents Windows from timing out while subscribing to the
// entire monorepo and root node_modules tree.
config.watchFolders = [__dirname];

module.exports = withNativeWind(config, { input: './global.css' });
