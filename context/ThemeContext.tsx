import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, useColorScheme } from "react-native";

import baseColors from "@/constants/colors";
import { BASE_URL } from "@/services/averon";
import { useAuth } from "@/context/AuthContext";
import { getBuiltInApiKey } from "@/utils/config";
import { createLogger } from '@/utils/logger';

const logger = createLogger('ThemeContext');
const APP_NAME = Constants.expoConfig?.name ?? "App";

export interface TemaData {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  foreground_color: string;
  logo_url: string | null;
  nome_marca: string;
  gamificacao_ativa?: boolean;
  comunidade_ativa?: boolean;
  perfil_ativo?: boolean;
}

export interface Banner {
  id: string;
  image_url: string;
  link_url: string | null;
  ordem: number;
  ativo: boolean;
}

type ColorPalette = typeof baseColors.light;
export type ColorSchemeOverride = "light" | "dark" | "system";

const TEMA_CACHE_KEY = "averon_tema_cache";
const SCHEME_PREF_KEY = "averon_color_scheme";

interface ThemeContextValue {
  colors: ColorPalette;
  brandName: string;
  logoUrl: string | null;
  tema: TemaData | null;
  banners: Banner[];
  isDark: boolean;
  colorSchemeOverride: ColorSchemeOverride;
  setColorSchemeOverride: (s: ColorSchemeOverride) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: baseColors.light,
  brandName: APP_NAME,
  logoUrl: null,
  tema: null,
  banners: [],
  isDark: false,
  colorSchemeOverride: "system",
  setColorSchemeOverride: () => {},
});

function resolveScheme(
  override: ColorSchemeOverride,
  device: "light" | "dark" | null | undefined,
): "light" | "dark" {
  if (override === "system") return device === "dark" ? "dark" : "light";
  return override;
}

function getBase(scheme: "light" | "dark"): ColorPalette {
  return scheme === "dark" ? baseColors.dark : baseColors.light;
}

function hexLuminance(hex: string): number {
  const h = hex.replace(/^#/, "");
  if (h.length < 6) return 1;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function lightenHex(hex: string, amount: number): string {
  const h = hex.replace(/^#/, "");
  const r = Math.min(255, parseInt(h.slice(0, 2), 16) + Math.round(255 * amount));
  const g = Math.min(255, parseInt(h.slice(2, 4), 16) + Math.round(255 * amount));
  const b = Math.min(255, parseInt(h.slice(4, 6), 16) + Math.round(255 * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function mergeTheme(base: ColorPalette, tema: TemaData, dark: boolean): ColorPalette {
  const p = tema.primary_color;
  const accent = tema.accent_color;

  if (dark) {
    // Dark mode: keep dark structural colors, only apply brand primary/accent
    return {
      ...base,
      primary: p,
      tint: p,
      accent: accent + "22",
      accentForeground: accent,
      secondary: p + "25",
      secondaryForeground: p,
      warning: accent,
      warningForeground: "#ffffff",
    };
  }

  // Light mode: check if the brand background is actually dark
  const bgLum = hexLuminance(tema.background_color);
  const bgIsDark = bgLum < 0.15;

  if (bgIsDark) {
    // Dark background in "light" mode — derive dark-appropriate structural colors
    // from the background so cards/inputs don't appear white on black
    const cardColor = lightenHex(tema.background_color, 0.1);
    const borderColor = lightenHex(tema.background_color, 0.17);
    const mutedColor = lightenHex(tema.background_color, 0.07);
    const inputColor = lightenHex(tema.background_color, 0.14);
    return {
      ...baseColors.dark,
      background: tema.background_color,
      surface: cardColor,
      card: cardColor,
      foreground: tema.foreground_color,
      text: tema.foreground_color,
      cardForeground: tema.foreground_color,
      border: borderColor,
      input: inputColor,
      muted: mutedColor,
      mutedForeground: baseColors.dark.mutedForeground,
      primary: p,
      tint: p,
      accent: accent + "22",
      accentForeground: accent,
      secondary: p + "25",
      secondaryForeground: p,
      warning: accent,
      warningForeground: "#ffffff",
    };
  }

  // Normal light mode: apply all API brand colors
  return {
    ...base,
    primary: p,
    tint: p,
    background: tema.background_color,
    surface: tema.background_color,
    foreground: tema.foreground_color,
    text: tema.foreground_color,
    cardForeground: tema.foreground_color,
    accent: accent + "22",
    accentForeground: accent,
    secondary: p + "15",
    secondaryForeground: p,
    warning: accent,
    warningForeground: "#ffffff",
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceScheme = useColorScheme() as "light" | "dark" | null;
  const { apiKey } = useAuth();

  const [tema, setTema] = useState<TemaData | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [override, setOverride] = useState<ColorSchemeOverride>("system");
  const [colors, setColors] = useState<ColorPalette>(baseColors.light);
  const [brandName, setBrandName] = useState(APP_NAME);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const temaRef = useRef<TemaData | null>(null);
  const overrideRef = useRef<ColorSchemeOverride>("system");
  const deviceSchemeRef = useRef(deviceScheme);
  const apiKeyRef = useRef(apiKey);

  temaRef.current = tema;
  overrideRef.current = override;
  deviceSchemeRef.current = deviceScheme;
  apiKeyRef.current = apiKey;

  const effectiveScheme = resolveScheme(override, deviceScheme);
  const isDark = effectiveScheme === "dark";

  // Recompute colors when scheme changes
  useEffect(() => {
    const scheme = resolveScheme(overrideRef.current, deviceSchemeRef.current);
    const base = getBase(scheme);
    setColors(temaRef.current ? mergeTheme(base, temaRef.current, scheme === "dark") : base);
  }, [effectiveScheme]);

  const applyTema = useCallback((t: TemaData) => {
    const scheme = resolveScheme(overrideRef.current, deviceSchemeRef.current);
    const base = getBase(scheme);
    temaRef.current = t;
    setTema(t);
    setColors(mergeTheme(base, t, scheme === "dark"));
    setBrandName(t.nome_marca || APP_NAME);
    setLogoUrl(t.logo_url ?? null);
    logger.log('Applied tema', t);
    AsyncStorage.setItem(TEMA_CACHE_KEY, JSON.stringify(t)).catch(() => {});
  }, []);

  const fetchTema = useCallback(() => {
    const key = apiKeyRef.current;
    if (!key) return;
    fetch(`${BASE_URL}/tema?t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${key}`, "Cache-Control": "no-cache" },
    })
      .then((res) => res.json())
      .then((json) => {
        // API returns { ok, config: {...}, banners: [...] }
        const payload = json.config ?? json.data;
        if (json.ok && payload) applyTema(payload as TemaData);
        if (json.ok && Array.isArray(json.banners)) {
          setBanners(
            // filter out only banners explicitly disabled; if field is absent treat as active
            (json.banners as Banner[]).filter((b) => b.ativo !== false)
          );
        }
      })
      .catch(() => {});
  }, [applyTema]);

  const setColorSchemeOverride = useCallback(
    (s: ColorSchemeOverride) => {
      overrideRef.current = s;
      setOverride(s);
      AsyncStorage.setItem(SCHEME_PREF_KEY, s).catch(() => {});
      const scheme = resolveScheme(s, deviceSchemeRef.current);
      const base = getBase(scheme);
      setColors(
        temaRef.current ? mergeTheme(base, temaRef.current, scheme === "dark") : base,
      );
    },
    [],
  );

  // Restore cached tema + scheme preference on mount, then immediately
  // fetch a fresh tema using the built-in API key (if set) so branding
  // is applied before AuthContext finishes its own init sequence.
  useEffect(() => {
    const builtInKey = getBuiltInApiKey();
    Promise.all([
      AsyncStorage.getItem(TEMA_CACHE_KEY),
      AsyncStorage.getItem(SCHEME_PREF_KEY),
    ])
      .then(([rawTema, rawScheme]) => {
        if (rawScheme === "light" || rawScheme === "dark" || rawScheme === "system") {
          overrideRef.current = rawScheme;
          setOverride(rawScheme);
        }
        if (rawTema) {
          try { applyTema(JSON.parse(rawTema)); } catch {}
        }
        // Fetch fresh tema right away if we have a built-in key
        if (builtInKey) {
          fetch(`${BASE_URL}/tema?t=${Date.now()}`, {
            headers: { Authorization: `Bearer ${builtInKey}`, "Cache-Control": "no-cache" },
          })
            .then((r) => r.json())
            .then((json) => {
              const payload = json.config ?? json.data;
              if (json.ok && payload) applyTema(payload as TemaData);
              if (json.ok && Array.isArray(json.banners)) {
                setBanners((json.banners as Banner[]).filter((b) => b.ativo !== false));
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // Fetch tema on apiKey change, then poll every 30s and on app focus
  useEffect(() => {
    if (!apiKey) return;

    fetchTema();

    const interval = setInterval(fetchTema, 30_000);

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") fetchTema();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [apiKey, fetchTema]);

  return (
    <ThemeContext.Provider
      value={{ colors, brandName, logoUrl, tema, banners, isDark, colorSchemeOverride: override, setColorSchemeOverride }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
