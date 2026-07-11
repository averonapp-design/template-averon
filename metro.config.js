const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Exclude native Android/iOS source directories from Metro watcher
// to avoid ENOENT crashes from react-native-webview temp dirs
const { blockList } = config.resolver;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nativeBlockList = new RegExp(
  escapeRegex(path.join("react-native-webview", "android")) +
    "|" +
    escapeRegex(path.join("react-native-webview", "ios")) +
    "|react-native-webview_tmp" +
    "|react-native-worklets_tmp"
);

config.resolver.blockList = blockList
  ? [blockList, nativeBlockList].flat()
  : nativeBlockList;

module.exports = config;
