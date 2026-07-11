import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppState, Platform } from "react-native";

// expo-screen-capture requires native binaries — not available in Expo Go
const isExpoGo = Constants.appOwnership === "expo";
let ScreenCapture: typeof import("expo-screen-capture") | null = null;
if (!isExpoGo) {
  try { ScreenCapture = require("expo-screen-capture"); } catch {}
}

import { Aluno, averonApi, setSessionRevokedHandler } from "@/services/averon";

export interface AuthConfig {
  require_login: boolean;
  allow_signup: boolean;
  block_screenshot: boolean;
  block_multi_device: boolean;
}

interface AuthContextValue {
  aluno: Aluno | null;
  apiKey: string | null;
  alunoToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authConfig: AuthConfig | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithBiometrics: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  saveApiKey: (key: string, adminPassword: string) => Promise<void>;
  refreshAluno: () => Promise<void>;
  updateProfile: (data: { nome?: string; avatar_url?: string }) => Promise<void>;
  uploadAvatar: (fileUri: string, mimeType?: string) => Promise<string>;
  hasBiometricCredentials: () => Promise<boolean>;
  setSession: (accessToken: string, aluno: Aluno) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const KEY_API_KEY = "averon_api_key";
const KEY_ALUNO_TOKEN = "averon_aluno_token";
const KEY_ALUNO_DATA = "averon_aluno_data";
const KEY_BIO_EMAIL = "averon_bio_email";
const KEY_BIO_PASSWORD = "averon_bio_password";
// Local override for avatar URL — persists across sessions even if averonapp.com
// does not support updating the profile (PATCH /auth/me returns 500 or 404).
const KEY_AVATAR_OVERRIDE = "averon_avatar_override";
const KEY_DEVICE_ID = "averon_device_id";

export async function getOrCreateDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(KEY_DEVICE_ID);
  if (!id) {
    id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    await AsyncStorage.setItem(KEY_DEVICE_ID, id);
  }
  return id;
}

const SERVER_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "http://localhost:8080";

async function fetchApiKeyFromServer(): Promise<string | null> {
  // In production builds (Play Store / App Store), the proxy server doesn't
  // exist — use the API key baked in at build time via EXPO_PUBLIC_API_KEY.
  const builtInKey = process.env.EXPO_PUBLIC_API_KEY;
  if (builtInKey) return builtInKey;

  try {
    const res = await fetch(`${SERVER_BASE}/api/config`, { method: "GET" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.configured && data.apiKey ? String(data.apiKey) : null;
  } catch {
    return null;
  }
}

async function pushApiKeyToServer(
  apiKey: string,
  adminPassword: string
): Promise<void> {
  const res = await fetch(`${SERVER_BASE}/api/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, adminPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? "server_error");
  }
}

// SecureStore has a ~2048 byte limit per value — use it ONLY for small sensitive data.
// Profile/non-sensitive data always goes to AsyncStorage (no size limit).
const ASYNC_ONLY_KEYS = new Set([KEY_ALUNO_DATA]);

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web" || ASYNC_ONLY_KEYS.has(key)) {
    return AsyncStorage.getItem(key);
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // Fallback to AsyncStorage if SecureStore fails (e.g. device not enrolled)
    return AsyncStorage.getItem(key);
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web" || ASYNC_ONLY_KEYS.has(key)) {
    return AsyncStorage.setItem(key, value);
  }
  try {
    return await SecureStore.setItemAsync(key, value);
  } catch {
    // Fallback: still save to AsyncStorage so the session isn't lost
    return AsyncStorage.setItem(key, value);
  }
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web" || ASYNC_ONLY_KEYS.has(key)) {
    return AsyncStorage.removeItem(key);
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}
  // Always clear from AsyncStorage too (handles fallback writes)
  await AsyncStorage.removeItem(key).catch(() => {});
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [alunoToken, setAlunoToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    restoreSession();
  }, []);

  // ── Block screenshots when the tenant has it enabled ──────────────────────
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (authConfig?.block_screenshot) {
      ScreenCapture?.preventScreenCaptureAsync().catch(() => {});
    } else {
      ScreenCapture?.allowScreenCaptureAsync().catch(() => {});
    }
  }, [authConfig?.block_screenshot]);

  // ── Re-fetch authConfig when app comes to foreground or on guest polling ────
  useEffect(() => {
    if (!apiKey) return;

    async function refreshAuthConfig() {
      try {
        const temaRes = await averonApi.getTema(apiKey!).catch(() => null);
        const tc = (temaRes as any)?.config ?? (temaRes as any)?.data ?? {};
        setAuthConfig((prev) => ({
          require_login: tc.auth_require_login ?? prev?.require_login ?? true,
          allow_signup: tc.auth_allow_signup ?? prev?.allow_signup ?? true,
          block_screenshot: tc.block_screenshot ?? prev?.block_screenshot ?? false,
          block_multi_device: tc.block_multi_device ?? prev?.block_multi_device ?? false,
        }));
      } catch {}
    }

    // AppState: re-fetch when app returns to foreground (native & web)
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshAuthConfig();
    });

    // Polling: re-fetch every 30s in guest mode so config changes propagate quickly
    const pollInterval = setInterval(() => {
      if (!alunoToken) refreshAuthConfig();
    }, 30_000);

    return () => {
      appStateSub.remove();
      clearInterval(pollInterval);
    };
  }, [apiKey, alunoToken]);

  // ── Handle session_revoked: clear local session when another device logs in ─
  useEffect(() => {
    const handleRevoked = async () => {
      await Promise.all([
        secureDelete(KEY_ALUNO_TOKEN),
        secureDelete(KEY_ALUNO_DATA),
        AsyncStorage.removeItem(KEY_AVATAR_OVERRIDE),
        AsyncStorage.setItem("averon_logout_reason", "outro_dispositivo"),
      ]);
      setAlunoToken(null);
      setAluno(null);
    };
    setSessionRevokedHandler(handleRevoked);
    return () => setSessionRevokedHandler(() => {});
  }, []);

  async function resolveApiKey(): Promise<string | null> {
    const serverKey = await fetchApiKeyFromServer();
    if (serverKey) {
      await secureSet(KEY_API_KEY, serverKey);
      return serverKey;
    }
    return secureGet(KEY_API_KEY);
  }

  async function restoreSession() {
    try {
      // FASE 1: Apenas leitura local — zero rede, zero espera
      const builtInKey = process.env.EXPO_PUBLIC_API_KEY ?? null;
      const [cachedKey, storedToken, storedData] = await Promise.all([
        builtInKey ? Promise.resolve(builtInKey) : secureGet(KEY_API_KEY),
        secureGet(KEY_ALUNO_TOKEN),
        secureGet(KEY_ALUNO_DATA),
      ]);

      const hasCachedSession = !!(cachedKey && storedToken && storedData);
      if (hasCachedSession) {
        // Restaura a sessão do cache — app abre em ~20ms
        setApiKey(cachedKey!);
        setAlunoToken(storedToken!);
        const parsed = JSON.parse(storedData!);
        const avatarOverride = await AsyncStorage.getItem(KEY_AVATAR_OVERRIDE);
        setAluno(avatarOverride ? { ...parsed, avatar_url: avatarOverride } : parsed);
        setIsLoading(false);
        // FASE 2: Valida em segundo plano (não bloqueia nada)
        validateInBackground(cachedKey!, storedToken!);
        return;
      }

      // Sem sessão cacheada: precisa buscar a apiKey da rede mesmo
      // (usuário nunca logou ou fez logout — espera aceitável)
      const serverKey = await fetchApiKeyFromServer() ?? cachedKey;
      if (serverKey) {
        setApiKey(serverKey);
        await secureSet(KEY_API_KEY, serverKey);
        try {
          const [cfg, temaRes] = await Promise.all([
            averonApi.getAuthConfig(serverKey).catch(() => null),
            averonApi.getTema(serverKey).catch(() => null),
          ]);
          const tc = (temaRes as any)?.config ?? (temaRes as any)?.data ?? {};
          setAuthConfig({
            require_login: tc.auth_require_login ?? (cfg as any)?.require_login ?? true,
            allow_signup: tc.auth_allow_signup ?? (cfg as any)?.allow_signup ?? true,
            block_screenshot: (cfg as any)?.block_screenshot ?? false,
            block_multi_device: (cfg as any)?.block_multi_device ?? false,
          });
        } catch {
          setAuthConfig({ require_login: true, allow_signup: true, block_screenshot: false, block_multi_device: false });
        }
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }

  async function validateInBackground(currentApiKey: string, storedToken: string) {
    try {
      // Busca apiKey atualizada em background
      const serverKey = await fetchApiKeyFromServer();
      const effectiveKey = serverKey ?? currentApiKey;
      if (serverKey && serverKey !== currentApiKey) {
        await secureSet(KEY_API_KEY, serverKey);
        setApiKey(serverKey);
      }

      // Atualiza authConfig em background (auth flags vêm do /tema)
      try {
        const [cfg, temaRes] = await Promise.all([
          averonApi.getAuthConfig(effectiveKey).catch(() => null),
          averonApi.getTema(effectiveKey).catch(() => null),
        ]);
        const tc = (temaRes as any)?.config ?? (temaRes as any)?.data ?? {};
        setAuthConfig({
          require_login: tc.auth_require_login ?? (cfg as any)?.require_login ?? true,
          allow_signup: tc.auth_allow_signup ?? (cfg as any)?.allow_signup ?? true,
          block_screenshot: (cfg as any)?.block_screenshot ?? false,
          block_multi_device: (cfg as any)?.block_multi_device ?? false,
        });
      } catch {}

      // Valida o token
      const res = await averonApi.me(effectiveKey, storedToken);
      if (res.ok && res.aluno) {
        const avatarOverride = await AsyncStorage.getItem(KEY_AVATAR_OVERRIDE);
        const merged = avatarOverride
          ? { ...res.aluno, avatar_url: avatarOverride }
          : res.aluno;
        setAluno(merged);
        await secureSet(KEY_ALUNO_DATA, JSON.stringify(merged));
      } else {
        // Token expirou — força re-login
        await secureDelete(KEY_ALUNO_TOKEN);
        await secureDelete(KEY_ALUNO_DATA);
        setAlunoToken(null);
        setAluno(null);
      }
    } catch (e: any) {
      const isNetworkErr =
        String(e?.message).includes("Network request failed") ||
        String(e?.message).includes("Failed to fetch") ||
        String(e?.message).includes("proxy_error") ||
        e?.name === "TypeError" ||
        e?.name === "AbortError";
      if (!isNetworkErr) {
        // Erro real (não de rede) → desloga
        await secureDelete(KEY_ALUNO_TOKEN);
        await secureDelete(KEY_ALUNO_DATA);
        setAlunoToken(null);
        setAluno(null);
      }
      // Erro de rede → mantém sessão cacheada, usuário não é expulso
    }
  }

  const login = useCallback(
    async (email: string, password: string) => {
      let key = apiKey;
      if (!key) {
        key = await resolveApiKey();
      }
      if (!key) throw new Error("API Key não configurada. Contate o administrador.");

      const res = await averonApi.login(key, email, password);
      if (!res.ok) throw new Error("Credenciais inválidas");

      await Promise.all([
        secureSet(KEY_ALUNO_TOKEN, res.access_token),
        secureSet(KEY_ALUNO_DATA, JSON.stringify(res.aluno)),
        ...(Platform.OS !== "web"
          ? [secureSet(KEY_BIO_EMAIL, email), secureSet(KEY_BIO_PASSWORD, password)]
          : []),
      ]);
      if (!apiKey) setApiKey(key);
      setAlunoToken(res.access_token);
      setAluno(res.aluno);

      // Register device for multi-device session management (fire-and-forget)
      getOrCreateDeviceId()
        .then((deviceId) =>
          averonApi.registerDevice(
            key!,
            res.access_token,
            deviceId,
            Platform.OS === "ios" ? "ios" : "android"
          )
        )
        .catch(() => {});

      // Fire daily_login XP event (fire-and-forget)
      averonApi.postEvento(key!, res.aluno.id, "daily_login").catch(() => {});
    },
    [apiKey]
  );

  // Used after signup confirm — saves token and aluno without calling login endpoint
  const setSession = useCallback(async (accessToken: string, alunoData: Aluno) => {
    await Promise.all([
      secureSet(KEY_ALUNO_TOKEN, accessToken),
      secureSet(KEY_ALUNO_DATA, JSON.stringify(alunoData)),
    ]);
    setAlunoToken(accessToken);
    setAluno(alunoData);

    // Register device after signup (fire-and-forget)
    const key = await secureGet(KEY_API_KEY);
    if (key) {
      getOrCreateDeviceId()
        .then((deviceId) =>
          averonApi.registerDevice(
            key,
            accessToken,
            deviceId,
            Platform.OS === "ios" ? "ios" : "android"
          )
        )
        .catch(() => {});
    }
  }, []);

  const hasBiometricCredentials = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") return false;
    try {
      const [email, password] = await Promise.all([
        secureGet(KEY_BIO_EMAIL),
        secureGet(KEY_BIO_PASSWORD),
      ]);
      return !!(email && password);
    } catch {
      return false;
    }
  }, []);

  const loginWithBiometrics = useCallback(async () => {
    if (Platform.OS === "web") throw new Error("Biometria não disponível na web");
    const email = await secureGet(KEY_BIO_EMAIL);
    const password = await secureGet(KEY_BIO_PASSWORD);
    if (!email || !password) throw new Error("no_credentials");
    await login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    await Promise.all([
      secureDelete(KEY_ALUNO_TOKEN),
      secureDelete(KEY_ALUNO_DATA),
      AsyncStorage.removeItem(KEY_AVATAR_OVERRIDE),
    ]);
    setAlunoToken(null);
    setAluno(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!apiKey || !alunoToken) throw new Error("Não autenticado");
    await averonApi.deleteAccount(apiKey, alunoToken);
    await Promise.all([
      secureDelete(KEY_ALUNO_TOKEN),
      secureDelete(KEY_ALUNO_DATA),
      secureDelete(KEY_BIO_EMAIL),
      secureDelete(KEY_BIO_PASSWORD),
      AsyncStorage.removeItem(KEY_AVATAR_OVERRIDE),
    ]);
    setAlunoToken(null);
    setAluno(null);
  }, [apiKey, alunoToken]);

  const saveApiKey = useCallback(
    async (key: string, adminPassword: string) => {
      await pushApiKeyToServer(key, adminPassword);
      await secureSet(KEY_API_KEY, key);
      setApiKey(key);
    },
    []
  );

  const refreshAluno = useCallback(async () => {
    if (!apiKey || !alunoToken) return;
    try {
      const res = await averonApi.me(apiKey, alunoToken);
      if (res.ok && res.aluno) {
        // Merge local avatar override so a successful upload isn't lost when
        // the server profile doesn't yet reflect the new avatar URL.
        const avatarOverride = await AsyncStorage.getItem(KEY_AVATAR_OVERRIDE);
        const merged = avatarOverride
          ? { ...res.aluno, avatar_url: avatarOverride }
          : res.aluno;
        setAluno(merged);
        await secureSet(KEY_ALUNO_DATA, JSON.stringify(merged));
      }
    } catch {}
  }, [apiKey, alunoToken]);

  const updateProfile = useCallback(
    async (data: { nome?: string; avatar_url?: string }) => {
      if (!apiKey || !alunoToken) throw new Error("Não autenticado");
      const res = await averonApi.updateProfile(apiKey, alunoToken, data);
      if (res.ok) {
        setAluno(res.aluno);
        await secureSet(KEY_ALUNO_DATA, JSON.stringify(res.aluno));
      }
    },
    [apiKey, alunoToken]
  );

  const uploadAvatar = useCallback(
    async (fileUri: string, mimeType = "image/jpeg"): Promise<string> => {
      if (!apiKey || !alunoToken) throw new Error("Não autenticado");
      const res = await averonApi.uploadAvatar(apiKey, alunoToken, fileUri, mimeType);
      const newUrl = res.avatar_url;

      if (newUrl) {
        // Always force-update avatar locally, regardless of whether the server
        // PATCH succeeded. averonapp.com may not support PATCH /auth/me, but
        // the image is stored on GCS and served via our proxy.
        setAluno((prev) => (prev ? { ...prev, avatar_url: newUrl } : prev));
        // Persist the override so next launch also shows the new avatar.
        await AsyncStorage.setItem(KEY_AVATAR_OVERRIDE, newUrl);
        // Save updated aluno to local storage
        const savedData = await AsyncStorage.getItem(KEY_ALUNO_DATA);
        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            await secureSet(KEY_ALUNO_DATA, JSON.stringify({ ...parsed, avatar_url: newUrl }));
          } catch {}
        }
      } else if (res.aluno) {
        setAluno(res.aluno);
        await secureSet(KEY_ALUNO_DATA, JSON.stringify(res.aluno));
      }

      return newUrl ?? "";
    },
    [apiKey, alunoToken]
  );

  return (
    <AuthContext.Provider
      value={{
        aluno,
        apiKey,
        alunoToken,
        isLoading,
        isAuthenticated: !!alunoToken && !!aluno,
        authConfig,
        login,
        loginWithBiometrics,
        logout,
        deleteAccount,
        saveApiKey,
        refreshAluno,
        updateProfile,
        uploadAvatar,
        hasBiometricCredentials,
        setSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
