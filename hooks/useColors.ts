import { useTheme } from "@/context/ThemeContext";

/**
 * Returns the active color palette.
 *
 * Colors are merged from:
 *   1. The static base palette (constants/colors.ts)
 *   2. The tenant's API theme (GET /tema) — applied on boot and cached
 *
 * Dark mode is handled inside ThemeContext so every consumer
 * automatically gets the right colors for the current scheme.
 */
export function useColors() {
  const { colors } = useTheme();
  return colors;
}
