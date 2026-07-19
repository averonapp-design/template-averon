import Constants from "expo-constants";

/**
 * Resolves the API Key built into this app release.
 * Checks Expo config extra parameters first (set via app.config.js / env.json),
 * then falls back to process.env.EXPO_PUBLIC_API_KEY.
 */
export function getBuiltInApiKey(): string | null {
  const extraKey = Constants.expoConfig?.extra?.apiKey;
  if (typeof extraKey === "string" && extraKey.trim().length > 0) {
    return extraKey.trim();
  }
  const envKey = process.env.EXPO_PUBLIC_API_KEY;
  if (typeof envKey === "string" && envKey.trim().length > 0) {
    return envKey.trim();
  }
  return null;
}
