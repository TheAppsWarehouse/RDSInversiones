const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * React Native 0.79.x ships private API files (e.g. Performance.js) that use
 * Flow type annotations and `export type { }` syntax. With pnpm the physical
 * path of those files is:
 *
 *   node_modules/.pnpm/react-native@X_HASH/node_modules/react-native/src/…
 *
 * Metro's default transformIgnorePatterns only inspects the *first* segment
 * after "node_modules/" — it sees ".pnpm" (not whitelisted), skips Babel
 * entirely for those files, and then chokes on the Flow syntax.
 *
 * The pattern below extends the negative lookahead with `(?:.*node_modules/)?`
 * so that the whitelist check is applied at ANY depth in the path, making
 * react-native (and related packages) always Babel-transformed regardless of
 * the package-manager's storage layout (npm flat, yarn, or pnpm virtual store).
 */
const PACKAGES_TO_TRANSFORM = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  'expo(nent)?',
  '@expo(nent)?/.*',
  '@expo-google-fonts/.*',
  'react-navigation',
  '@react-navigation/.*',
  '@unimodules/.*',
  'unimodules',
  'sentry-expo',
  'native-base',
  'react-native-svg',
  'react-native-paper',
  'react-native-reanimated',
  'react-native-safe-area-context',
].join('|');

config.transformer = {
  ...config.transformer,
  transformIgnorePatterns: [
    `node_modules/(?!(?:.*node_modules/)?(?:${PACKAGES_TO_TRANSFORM}))`,
  ],
};

module.exports = config;
