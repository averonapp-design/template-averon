import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";

const AVERON_DIRECT = "https://www.averonapp.com/api/public/v1";

function resolveBaseUrl(): string {
  // Direct API URL override — injected by the Averon CI/CD build system
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) return apiUrl.replace(/\/$/, "");
  // When running inside Replit (dev or web preview), route through the
  // local proxy server to avoid CORS and mobile network restrictions.
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api/proxy/v1`;
  // In TestFlight / App Store builds, EXPO_PUBLIC_PROXY_BASE is set in eas.json.
  // Route all API calls through the proxy so PATCH /auth/me and other calls work.
  const proxyBase = process.env.EXPO_PUBLIC_PROXY_BASE;
  if (proxyBase) return `${proxyBase.replace(/\/$/, "")}/proxy/v1`;
  return AVERON_DIRECT;
}

export const BASE_URL = resolveBaseUrl();

// Base URL of our own proxy server (for custom endpoints like /upload/avatar).
// EXPO_PUBLIC_PROXY_BASE is set explicitly in eas.json for standalone builds
// (TestFlight / App Store) where EXPO_PUBLIC_DOMAIN is unavailable.
function resolveProxyBase(): string | null {
  // Explicit override (EAS build env — production / app-store / preview)
  const explicit = process.env.EXPO_PUBLIC_PROXY_BASE;
  if (explicit) return explicit.replace(/\/$/, "");
  // Replit dev / web preview — derive from the dev domain
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api` : null;
}

const PROXY_BASE = resolveProxyBase();

// For file uploads: native apps call the API directly (no CORS issues).
// Web preview must go through the proxy (browser enforces CORS).
function resolveUploadUrl(): string {
  if (Platform.OS !== "web") return AVERON_DIRECT;
  return BASE_URL;
}

const UPLOAD_URL = resolveUploadUrl();

export interface Aluno {
  id: string;
  email: string;
  nome: string;
  avatar_url?: string | null;
  is_admin: boolean;
}

export interface LoginResponse {
  ok: boolean;
  access_token: string;
  expires_in: number;
  aluno: Aluno;
}

export interface Curso {
  id: string;
  titulo: string;
  descricao: string;
  capa_url: string | null;
  publicado: boolean;
  ordem?: number;
  created_at: string;
  // DRIP / scheduled release
  liberar_apos_dias?: number;
  liberar_em_data?: string | null;
  disponivel?: boolean;
  liberado_em?: string | null;
  // Free for all registered users
  gratis_cadastro?: boolean;
  // GET /cursos returns a summary modulos[] so the home screen can render
  // module cards without needing a per-course /cursos/:id call.
  modulos?: ModuloBasico[];
}

export interface MeuCurso extends Curso {
  origem: string;
  liberado_em: string;
}

export interface AcessoCurso {
  curso_id: string;
  titulo: string;
  descricao: string;
  capa_url: string | null;
  publicado: boolean;
  liberado: boolean;
  origem: string | null;
  liberado_em: string | null;
  link_sem_acesso: string | null;
  ordem?: number;
  gratis_cadastro?: boolean;
  // Optional: API may return basic module structure even for locked courses.
  modulos?: Pick<Modulo, "id" | "titulo" | "capa_url">[];
}

export interface Anexo {
  id: string;
  titulo: string;
  file_url: string;
  mime_type: string;
  size_bytes: number;
  ordem: number;
}

export interface ConteudoNormalizado {
  tipo: "video" | "pdf" | "texto" | "html" | "figurinhas";
  video_url?: string | null;
  video_provider?: "vimeo" | "youtube" | "embed" | string | null;
  embed_url?: string | null;
  player_url?: string | null;
  youtube_id?: string | null;
  vimeo_id?: string | null;
  vimeo_hash?: string | null;
  pdf_url?: string | null;
  texto?: string | null;
  html?: string | null;
  stickers?: string[];
  permitir_download?: boolean;
  download_path?: string | null;
}

export interface Aula {
  id: string;
  titulo: string;
  descricao?: string | null;
  conteudo_tipo: "video" | "pdf" | "texto" | "html" | "figurinhas";
  // video_url  = sharing URL (https://youtu.be/XYZ, https://vimeo.com/ID/hash, ...)
  // embed_url  = ready-to-use player URL for WebView/iframe (all providers)
  // player_url = alias for embed_url
  video_url?: string | null;
  embed_url?: string | null;
  player_url?: string | null;
  video_provider?: "vimeo" | "youtube" | "embed" | string | null;
  vimeo_id?: string | null;
  vimeo_hash?: string | null;
  youtube_id?: string | null;
  conteudo_url?: string | null;
  conteudo_texto?: string | null;
  pdf_url?: string | null;
  texto?: string | null;
  html?: string | null;
  stickers?: string[];
  download_path?: string | null;
  permitir_download?: boolean;
  xp_recompensa?: number;
  conteudo?: ConteudoNormalizado;
  capa_url: string | null;
  duracao_seg: number;
  ordem: number;
  anexos?: Anexo[];
  // Drip content
  liberar_apos_dias?: number;
  liberar_em_data?: string | null;
  disponivel?: boolean;
  disponivel_em?: string | null;
  // Free for all registered users (DRIP rules still apply on top)
  gratis_cadastro?: boolean;
}

export interface Modulo {
  id: string;
  titulo: string;
  ordem: number;
  capa_url: string | null;
  exibir_titulo?: boolean;
  xp_necessario?: number;
  xp_recompensa?: number;
  // DRIP / scheduled release
  liberar_apos_dias?: number;
  liberar_em_data?: string | null;
  disponivel?: boolean;
  liberado_em?: string | null;
  // Free for all registered users (DRIP rules still apply on top)
  gratis_cadastro?: boolean;
  aulas: Aula[];
}

export type ModuloBasico = Omit<Modulo, "aulas">;

export interface CursoDetalhado extends Curso {
  modulos: Modulo[];
}

export interface ProdutoListar {
  id: string;
  titulo: string;
  ordem: number;
  capa_url: string | null;
  publicado: boolean;
  categoria_id?: string | null;
  created_at?: string;
  gratis_cadastro?: boolean;
}

export interface CategoriaListar {
  id: string;
  nome: string;
  ordem: number;
  produtos: ProdutoListar[];
}

export interface SemAcessoError {
  ok: false;
  error: "sem_acesso";
  message: string;
  link_sem_acesso: string | null;
}

// ── Gamificação ──────────────────────────────────────────────

export interface Conquista {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  icone: string;
  pontos: number;
  criterio_tipo: string;
  criterio_valor?: number;
  evento_esperado?: string;
  ativo: boolean;
  desbloqueada: boolean;
  desbloqueada_em?: string | null;
}

export interface Meta {
  id: string;
  titulo: string;
  descricao: string;
  pontos_alvo: number;
  ativo: boolean;
  progresso?: number;
  atingida?: boolean;
  periodo?: "diaria" | "semanal" | string;
}

export interface ScoreConquista {
  codigo: string;
  titulo: string;
  icone: string;
  unlocked_at: string;
}

export interface ScoreMeta {
  titulo: string;
  pontos_alvo: number;
  progresso: number;
  atingida: boolean;
}

export interface Nivel {
  position: number;
  nome: string;
  min_xp: number;
  emoji?: string;
}

export interface ScoreAluno {
  aluno_id: string;
  pontos: number;
  nivel?: string;
  nivel_atual?: { nome: string; min_xp: number; position: number; emoji?: string } | null;
  proximo_nivel?: { nome: string; min_xp: number; position: number; emoji?: string } | null;
  conquistas: ScoreConquista[];
  metas?: ScoreMeta[];
}

export type GamificacaoEvento =
  | "watch_lesson"
  | "complete_course"
  | "community_post"
  | "community_comment"
  | "community_like"
  | "download_file"
  | "daily_login"
  | "app_review"
  | (string & {});

export interface RankingEntry {
  posicao: number;
  aluno_id: string;
  nome: string;
  email: string;
  pontos: number;
  avatar_url?: string | null;
}

// ── Avaliações ───────────────────────────────────────────────

export interface Avaliacao {
  id: string;
  rating: number;
  comentario?: string | null;
  store: "internal" | "play_store" | "app_store" | string;
  aluno_id?: string;
  created_at: string;
}

// ── Notificações ─────────────────────────────────────────────

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo?: string | null;
  lida?: boolean;
  url?: string | null;
  created_at: string;
}

// ── Suporte ──────────────────────────────────────────────────

export interface SuporteConfig {
  preferred_channel: "whatsapp" | "email" | "ticket";
  whatsapp_number?: string | null;
  email_address?: string | null;
  mensagem_boas_vindas?: string | null;
}

export interface Ticket {
  id: string;
  assunto: string;
  status: "open" | "in_progress" | "closed";
  created_at: string;
  last_message_at?: string;
  last_message?: string;
  last_message_sender_type?: "aluno" | "admin";
  has_support_reply?: boolean;
}

export interface TicketMensagem {
  id: string;
  sender_type: "aluno" | "admin";
  sender_label: string;
  texto: string;
  mensagem: string;
  is_mine: boolean;
  is_support: boolean;
  created_at: string;
}

// ── Comunidade ──────────────────────────────────────────────

export interface ComunidadeStatus {
  ok: boolean;
  modo: "free" | "paid";
  locked: boolean;
  expires_at?: string | null;
  acesso_duracao?: string | null;
  descricao?: string;
  preco_centavos?: number;
  moeda?: string;
  checkout_url?: string | null;
  cta_url?: string | null;
}

export interface ApplePaymentProduto {
  id: number;
  nome: string;
  descricao?: string;
  preco: number;
  preco_cents?: number;
  apple_product_id: string | null;
  // Web checkout URLs — may be returned by the API for direct checkout
  checkout_url?: string | null;
  link?: string | null;
  cta_url?: string | null;
}

export interface ApplePaymentStatus {
  enabled: boolean;
  produtos: ApplePaymentProduto[];
  // Site-wide checkout fallback URL
  checkout_url?: string | null;
  loja_url?: string | null;
}

export interface ComunidadeAutor {
  id: string;
  nome: string;
  avatar_url?: string | null;
}

export interface ComunidadePost {
  id: string;
  texto: string;
  image_urls?: string[] | null;
  status: "approved" | "pending" | "rejected";
  autor: ComunidadeAutor;
  likes_count: number;
  liked_by_me: boolean;
  comments_count: number;
  created_at: string;
}

export interface ComunidadeComment {
  id: string;
  texto: string;
  autor: ComunidadeAutor;
  created_at: string;
}

export interface AddScoreResponse {
  ok: boolean;
  pontos_total: number;
  conquistas_desbloqueadas: { codigo: string; titulo: string; icone: string }[];
}

export interface EventoResponse {
  ok: boolean;
  evento: string;
  pontos_ganhos: number;
  pontos_total: number;
  novas_conquistas: { id: string; codigo: string; titulo: string; pontos: number; icone: string }[];
}

// ── Embed builder ─────────────────────────────────────────────

export type EmbedResult =
  | { kind: "youtube"; videoId: string }
  | { kind: "vimeo"; videoId: string; hash?: string }
  | { kind: "iframe"; src: string }
  | { kind: "video"; src: string };

export function buildEmbed(videoUrl: string | null | undefined): EmbedResult | null {
  if (!videoUrl) return null;
  try {
    const u = new URL(videoUrl);
    const h = u.hostname.replace(/^www\./, "");

    if (h === "youtu.be") {
      const videoId = u.pathname.slice(1).split("?")[0];
      return videoId ? { kind: "youtube", videoId } : null;
    }
    if (h.endsWith("youtube.com")) {
      let videoId: string | null = null;
      if (u.pathname === "/watch") videoId = u.searchParams.get("v");
      else if (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/"))
        videoId = u.pathname.split("/")[2];
      return videoId ? { kind: "youtube", videoId } : null;
    }
    if (h === "vimeo.com" || h.endsWith(".vimeo.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      const videoId = parts[0];
      const hashFromPath = parts[1];
      const hash = u.searchParams.get("h") || hashFromPath || undefined;
      return videoId ? { kind: "vimeo", videoId, hash } : null;
    }
    if (h.endsWith("loom.com")) {
      const m = u.pathname.match(/\/(share|embed)\/([a-zA-Z0-9]+)/);
      return m ? { kind: "iframe", src: `https://www.loom.com/embed/${m[2]}` } : null;
    }
    if (h.endsWith("pandavideo.com.br")) {
      return { kind: "iframe", src: videoUrl };
    }
    if (h.endsWith("wistia.com") || h.endsWith("wistia.net")) {
      const m = u.pathname.match(/\/(medias|embed)\/([a-zA-Z0-9]+)/);
      return m ? { kind: "iframe", src: `https://fast.wistia.net/embed/iframe/${m[2]}` } : null;
    }
    if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u.pathname)) {
      return { kind: "video", src: videoUrl };
    }
    // fallback: try iframe
    return { kind: "iframe", src: videoUrl };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── session_revoked global callback ───────────────────────────────────────────
// When a 401 with error=session_revoked is received from any API call,
// this callback is invoked so AuthContext can clear the local session.
let _sessionRevokedCb: (() => void) | null = null;
export function setSessionRevokedHandler(cb: () => void): void {
  _sessionRevokedCb = cb;
}

async function request<T>(
  path: string,
  apiKey: string,
  options: RequestInit = {},
  alunoToken?: string,
  retries = 3
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (alunoToken) {
    headers["x-aluno-token"] = alunoToken;
  }

  try {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers,
      });
    } catch (fetchErr: any) {
      // Network error or timeout — retry if we have attempts left
      if (retries > 0) {
        await sleep(Math.pow(2, 3 - retries) * 1000 + 500);
        return request<T>(path, apiKey, options, alunoToken, retries - 1);
      }
      const isTimeout = fetchErr?.name === "AbortError";
      throw new Error(isTimeout ? "timeout" : "network_error");
    }

    if (res.status === 401) {
      const body = await res.json().catch(() => ({}));
      if (body?.error === "session_revoked" && _sessionRevokedCb) {
        _sessionRevokedCb();
      }
      throw new Error(body?.error ?? "unauthorized");
    }

    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      const err: any = new Error(body?.error ?? "forbidden");
      err.code = body?.error;
      err.link_sem_acesso = body?.link_sem_acesso ?? null;
      err.message_pt = body?.message ?? "Acesso negado";
      // Some APIs return module structure even on 403 (blocking only lesson content).
      // Attach it so callers can still render locked module cards.
      err.modulos = body?.modulos ?? null;
      throw err;
    }

    if (res.status >= 500 && retries > 0) {
      await sleep(300);
      return request<T>(path, apiKey, options, alunoToken, retries - 1);
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error ?? errBody?.message ?? `Erro ${res.status}`);
    }

    const text = await res.text();

    // Empty body (can happen with proxy/CDN quirks) — retry if possible
    if (!text || !text.trim()) {
      if (retries > 0) {
        await sleep(500);
        return request<T>(path, apiKey, options, alunoToken, retries - 1);
      }
      throw new Error(`Resposta vazia do servidor. Endpoint: ${path}`);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      if (text.trimStart().startsWith("<")) {
        // HTML response — could be transient proxy error, retry if possible
        if (retries > 0) {
          await sleep(800);
          return request<T>(path, apiKey, options, alunoToken, retries - 1);
        }
        throw new Error(`Servidor retornou HTML em vez de JSON. Endpoint: ${path}`);
      }
      throw new Error(`Resposta inválida do servidor (status ${res.status})`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export const averonApi = {
  // ── Auth Config ──

  getAuthConfig: (apiKey: string) =>
    request<{ ok: boolean; require_login: boolean; allow_signup: boolean }>(
      "/auth/config",
      apiKey
    ),

  // ── Signup (2-step with email code) ──

  signupRequest: (apiKey: string, email: string, password: string, nome: string) =>
    request<{ ok: boolean; message: string }>(
      "/auth/signup/request",
      apiKey,
      { method: "POST", body: JSON.stringify({ email, password, nome }) }
    ),

  signupConfirm: (apiKey: string, email: string, code: string) =>
    request<{ ok: boolean; access_token: string; expires_in: number; aluno: Aluno }>(
      "/auth/signup/confirm",
      apiKey,
      { method: "POST", body: JSON.stringify({ email, code }) }
    ),

  requestPasswordReset: (apiKey: string, email: string) =>
    request<{ ok: boolean; message: string }>("/auth/password-reset/request", apiKey, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  confirmPasswordReset: (apiKey: string, email: string, code: string, new_password: string) =>
    request<{ ok: boolean }>("/auth/password-reset/confirm", apiKey, {
      method: "POST",
      body: JSON.stringify({ email, code, new_password }),
    }),

  login: (apiKey: string, email: string, password: string) =>
    request<LoginResponse>("/auth/login", apiKey, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: (apiKey: string, alunoToken: string) =>
    request<{ ok: boolean; aluno: Aluno }>("/auth/me", apiKey, {}, alunoToken),

  updateProfile: (apiKey: string, alunoToken: string, data: { nome?: string; avatar_url?: string }) =>
    request<{ ok: boolean; aluno: Aluno }>(
      "/auth/me",
      apiKey,
      { method: "PATCH", body: JSON.stringify(data) },
      alunoToken
    ),

  deleteAccount: (apiKey: string, alunoToken: string) =>
    request<{ ok: boolean }>(
      "/auth/me",
      apiKey,
      { method: "DELETE" },
      alunoToken
    ),

  uploadAvatar: async (
    apiKey: string,
    alunoToken: string,
    fileUri: string,
    mimeType = "image/jpeg"
  ): Promise<{ ok: boolean; avatar_url: string | null; aluno: Aluno | null }> => {
    const ext = mimeType === "image/png" ? "png" : "jpg";
    const type = mimeType === "image/png" ? "image/png" : "image/jpeg";
    const filename = `avatar.${ext}`;

    // ── Strategy 1: upload to our own proxy storage endpoint ──────────────────
    // The original /auth/avatar endpoint on averonapp.com returns 500 due to a
    // server-side storage bug. We work around it by uploading to our proxy, which
    // stores the image on GCS and returns a public URL, then PATCH /auth/me with
    // that URL. Available whenever PROXY_BASE is set (Replit dev / hosted build).
    if (PROXY_BASE) {
      let uploadUri = fileUri;
      if (Platform.OS !== "web" && !fileUri.startsWith("file://")) {
        const dest = `${FileSystem.cacheDirectory}avatar_upload_${Date.now()}.${ext}`;
        await FileSystem.copyAsync({ from: fileUri, to: dest });
        uploadUri = dest;
      }

      const fd = new FormData();
      if (Platform.OS !== "web") {
        fd.append("file", { uri: uploadUri, name: filename, type } as any);
      } else {
        const dataRes = await fetch(uploadUri);
        const blob = await dataRes.blob();
        fd.append("file", new File([blob], filename, { type }));
      }

      const uploadRes = await fetch(`${PROXY_BASE}/upload/avatar`, {
        method: "POST",
        body: fd,
      });
      if (!uploadRes.ok) {
        let errMsg = `proxy_upload_error_${uploadRes.status}`;
        try {
          const errBody = await uploadRes.json();
          errMsg = errBody?.error ?? errBody?.message ?? errMsg;
        } catch {}
        throw new Error(`${errMsg} [${uploadRes.status}]`);
      }
      const { avatar_url: newAvatarUrl } = await uploadRes.json();
      if (!newAvatarUrl) throw new Error("proxy_no_url");

      // Update the profile with the new avatar URL via PATCH /auth/me
      const patchRes = await fetch(`${BASE_URL}/auth/me`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "x-aluno-token": alunoToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ avatar_url: newAvatarUrl }),
      });
      let patchJson: any = {};
      try { patchJson = await patchRes.json(); } catch {}

      const aluno: Aluno | null = patchJson?.aluno ?? patchJson?.data?.aluno ?? null;
      return { ok: true, avatar_url: newAvatarUrl, aluno };
    }

    // ── Strategy 2: fallback — original /auth/avatar endpoint ─────────────────
    // Used only in standalone production builds where PROXY_BASE is unavailable.
    let json: any;

    if (Platform.OS !== "web") {
      let uploadUri = fileUri;
      if (!fileUri.startsWith("file://")) {
        const dest = `${FileSystem.cacheDirectory}avatar_upload_${Date.now()}.${ext}`;
        await FileSystem.copyAsync({ from: fileUri, to: dest });
        uploadUri = dest;
      }
      const fd = new FormData();
      fd.append("file", { uri: uploadUri, name: filename, type } as any);
      const res = await fetch(`${UPLOAD_URL}/auth/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "x-aluno-token": alunoToken,
        },
        body: fd,
      });
      if (!res.ok) {
        let errMsg = `upload_error_${res.status}`;
        try { const b = await res.json(); errMsg = b?.error ?? b?.message ?? errMsg; } catch {}
        throw new Error(`${errMsg} [${res.status}]`);
      }
      json = await res.json();
    } else {
      const fd = new FormData();
      const dataRes = await fetch(fileUri);
      const blob = await dataRes.blob();
      fd.append("file", new File([blob], filename, { type }));
      const res = await fetch(`${UPLOAD_URL}/auth/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "x-aluno-token": alunoToken,
        },
        body: fd,
      });
      if (!res.ok) {
        let errMsg = `upload_error_${res.status}`;
        try { const b = await res.json(); errMsg = b?.error ?? b?.message ?? errMsg; } catch {}
        throw new Error(`${errMsg} [${res.status}]`);
      }
      json = await res.json();
    }

    const payload = json.data ?? json.config ?? json;
    const avatarUrl: string | null =
      payload?.avatar_url ?? payload?.url ?? json.avatar_url ?? json.url ?? null;
    const aluno: Aluno | null = payload?.aluno ?? json.aluno ?? null;
    return { ok: true, avatar_url: avatarUrl, aluno };
  },

  // GET /cursos — needs only the API key. Returns courses with modulos[] summary
  // (no per-course /cursos/:id calls needed for home screen rendering).
  getCursos: (apiKey: string) =>
    request<{ data: Curso[]; total: number }>("/cursos", apiKey),

  getMeusCursos: (apiKey: string, alunoToken: string) =>
    request<{ ok: boolean; aluno_id: string; total: number; cursos: MeuCurso[] }>(
      "/meus-cursos",
      apiKey,
      {},
      alunoToken
    ),

  getAcessos: (apiKey: string, alunoId: string, alunoToken: string) =>
    request<{ ok: boolean; aluno_id: string; total: number; liberados: number; cursos: AcessoCurso[] }>(
      `/acessos/${encodeURIComponent(alunoId)}`,
      apiKey,
      {},
      alunoToken
    ),

  getCurso: (apiKey: string, alunoToken: string | null | undefined, id: string) =>
    request<CursoDetalhado>(`/cursos/${id}`, apiKey, {}, alunoToken ?? undefined),

  getProdutosListar: (apiKey: string, alunoToken?: string) =>
    request<{ categorias: CategoriaListar[] }>("/produtos/listar", apiKey, {}, alunoToken),

  // ── Gamificação ──

  getNiveis: (apiKey: string) =>
    request<{ data: Nivel[] }>("/gamificacao/niveis", apiKey),

  getConquistas: (apiKey: string, alunoId: string) =>
    request<{ data: Conquista[] }>(`/gamificacao/conquistas?aluno_id=${alunoId}`, apiKey),

  getMetas: (apiKey: string, alunoId: string) =>
    request<{ data: Meta[] }>(`/gamificacao/metas?aluno_id=${alunoId}`, apiKey),

  getScore: (apiKey: string, alunoId: string, alunoToken: string) =>
    request<ScoreAluno>(`/gamificacao/score/${alunoId}`, apiKey, {}, alunoToken),

  addScore: (
    apiKey: string,
    alunoId: string,
    alunoToken: string,
    pontos: number,
    motivo: string,
    metadata: Record<string, unknown> = {}
  ) =>
    request<AddScoreResponse>(
      `/gamificacao/score/${alunoId}`,
      apiKey,
      { method: "POST", body: JSON.stringify({ pontos, motivo, metadata }) },
      alunoToken
    ),

  postEvento: (
    apiKey: string,
    alunoId: string,
    evento: string,
    payload?: Record<string, unknown>
  ) =>
    request<EventoResponse>(
      "/gamificacao/eventos",
      apiKey,
      { method: "POST", body: JSON.stringify({ aluno_id: alunoId, evento, ...(payload ? { payload } : {}) }) }
    ),

  unlockConquista: (apiKey: string, alunoId: string, alunoToken: string, codigo: string) =>
    request<{ ok: boolean; ja_tinha: boolean; pontos_ganhos: number; pontos_total: number }>(
      "/gamificacao/unlock",
      apiKey,
      { method: "POST", body: JSON.stringify({ aluno_id: alunoId, codigo }) },
      alunoToken
    ),

  getRanking: (apiKey: string, limit = 20) =>
    request<{ data: RankingEntry[] }>(
      `/gamificacao/ranking?limit=${limit}`,
      apiKey
    ),

  getTema: (apiKey: string) =>
    request<{
      ok: boolean;
      data: {
        primary_color: string;
        secondary_color: string;
        accent_color: string;
        background_color: string;
        foreground_color: string;
        logo_url: string | null;
        nome_marca: string;
        updated_at: string;
      };
    }>("/tema", apiKey),

  updateTema: (
    apiKey: string,
    fields: {
      primary_color?: string;
      secondary_color?: string;
      accent_color?: string;
      background_color?: string;
      foreground_color?: string;
      logo_url?: string | null;
      nome_marca?: string;
    }
  ) =>
    request<{ ok: boolean }>(
      "/tema",
      apiKey,
      { method: "PUT", body: JSON.stringify(fields) }
    ),

  // ── Apple Pay / In-App Purchase ──

  getApplePaymentStatus: (apiKey: string, alunoToken?: string | null) =>
    request<ApplePaymentStatus>("/apple-payment/status", apiKey, {}, alunoToken ?? undefined),

  purchaseApplePayProduct: (
    apiKey: string,
    alunoToken: string,
    produtoId: number
  ) =>
    request<{ ok: boolean; checkout_url?: string | null; message?: string }>(
      "/apple-payment/purchase",
      apiKey,
      { method: "POST", body: JSON.stringify({ produto_id: produtoId }) },
      alunoToken
    ),

  // ── Comunidade ──

  getComunidadeStatus: (apiKey: string, alunoToken: string) =>
    request<ComunidadeStatus>("/comunidade/status", apiKey, {}, alunoToken),

  getComunidadePosts: (apiKey: string, alunoToken: string) =>
    request<{ ok: boolean; posts: ComunidadePost[] }>(
      "/comunidade/posts",
      apiKey,
      {},
      alunoToken
    ),

  createComunidadePost: (
    apiKey: string,
    alunoToken: string,
    texto: string,
    image_urls: string[] = []
  ) =>
    request<{ ok: boolean; id: string; status: string }>(
      "/comunidade/posts",
      apiKey,
      { method: "POST", body: JSON.stringify({ texto, image_urls }) },
      alunoToken
    ),

  likeComunidadePost: (apiKey: string, alunoToken: string, postId: string) =>
    request<{ ok: boolean; liked: boolean; likes_count: number }>(
      `/comunidade/posts/${postId}/like`,
      apiKey,
      { method: "POST" },
      alunoToken
    ),

  getComunidadeComments: (apiKey: string, alunoToken: string, postId: string) =>
    request<{ ok: boolean; comments: ComunidadeComment[] }>(
      `/comunidade/posts/${postId}/comments`,
      apiKey,
      {},
      alunoToken
    ),

  createComunidadeComment: (
    apiKey: string,
    alunoToken: string,
    postId: string,
    texto: string
  ) =>
    request<{ ok: boolean; id: string; status: "pending" | "approved" }>(
      `/comunidade/posts/${postId}/comments`,
      apiKey,
      { method: "POST", body: JSON.stringify({ texto }) },
      alunoToken
    ),

  uploadComunidadeMedia: async (
    apiKey: string,
    alunoToken: string,
    fileUri: string,
    mimeType = "image/jpeg"
  ): Promise<{ ok: boolean; url: string }> => {
    const ext = mimeType === "image/png" ? "png" : "jpg";
    const type = mimeType === "image/png" ? "image/png" : "image/jpeg";

    // Strategy 1: use our own proxy storage (same endpoint as avatar, works for any image)
    if (PROXY_BASE) {
      let uploadUri = fileUri;
      if (Platform.OS !== "web" && !fileUri.startsWith("file://")) {
        const dest = `${FileSystem.cacheDirectory}comunidade_upload_${Date.now()}.${ext}`;
        await FileSystem.copyAsync({ from: fileUri, to: dest });
        uploadUri = dest;
      }
      const fd = new FormData();
      if (Platform.OS !== "web") {
        fd.append("file", { uri: uploadUri, name: `post-img.${ext}`, type } as any);
      } else {
        const dataRes = await fetch(uploadUri);
        const blob = await dataRes.blob();
        fd.append("file", new File([blob], `post-img.${ext}`, { type }));
      }
      const res = await fetch(`${PROXY_BASE}/upload/avatar`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `proxy_upload_${res.status}`);
      }
      const { avatar_url } = await res.json();
      if (!avatar_url) throw new Error("proxy_no_url");
      return { ok: true, url: avatar_url };
    }

    // Strategy 2: fallback to upstream /comunidade/media (may be 404)
    const fd = new FormData();
    fd.append("file", { uri: fileUri, name: `post-img.${ext}`, type } as any);
    const res = await fetch(`${UPLOAD_URL}/comunidade/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "x-aluno-token": alunoToken,
      },
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? `upload_error_${res.status}`);
    }
    return res.json();
  },

  // ── Avaliações ──

  getAvaliacoes: (apiKey: string) =>
    request<{ ok: boolean; data: Avaliacao[] }>("/avaliacoes", apiKey),

  createAvaliacao: (
    apiKey: string,
    alunoToken: string,
    rating: number,
    comentario: string,
    store: string = "internal"
  ) =>
    request<{ ok: boolean; data: Avaliacao }>(
      "/avaliacoes",
      apiKey,
      { method: "POST", body: JSON.stringify({ rating, comentario, store }) },
      alunoToken
    ),

  // ── Notificações ──

  getNotificacoes: (apiKey: string, alunoToken: string) =>
    request<{ ok: boolean; enabled: boolean; notifications: Notificacao[] }>(
      "/notificacoes",
      apiKey,
      {},
      alunoToken
    ),

  trackNotificacao: (apiKey: string, alunoToken: string, id: string) =>
    request<{ ok: boolean }>(
      `/notificacoes/${id}/track`,
      apiKey,
      { method: "POST" },
      alunoToken
    ),

  // ── Suporte ──

  getSuporteConfig: (apiKey: string) =>
    request<{ ok: boolean; config: SuporteConfig }>("/suporte/config", apiKey),

  // prioridade "media" is broken in the Averon DB enum — omit it (server default) when selected
  createTicket: (
    apiKey: string,
    alunoToken: string,
    assunto: string,
    mensagem: string,
    prioridade?: "baixa" | "media" | "alta"
  ) => {
    const body: Record<string, string> = { assunto, mensagem };
    if (prioridade && prioridade !== "media") body.prioridade = prioridade;
    return request<{ ok: boolean; ticket_id: string; status: string }>(
      "/suporte/ticket",
      apiKey,
      { method: "POST", body: JSON.stringify(body) },
      alunoToken
    );
  },

  closeTicket: (apiKey: string, alunoToken: string, ticketId: string) =>
    request<{ ok: boolean; status: string }>(
      `/suporte/tickets/${ticketId}/fechar`,
      apiKey,
      { method: "POST" },
      alunoToken
    ),

  getTickets: (apiKey: string, alunoToken: string) =>
    request<{ ok: boolean; data: Ticket[]; tickets: Ticket[] }>(
      "/suporte/tickets",
      apiKey,
      {},
      alunoToken
    ),

  getTicketMensagens: (apiKey: string, alunoToken: string, ticketId: string) =>
    request<{
      ok: boolean;
      ticket: { id: string; assunto: string; status: string };
      data: TicketMensagem[];
      messages: TicketMensagem[];
    }>(`/suporte/tickets/${ticketId}/mensagens`, apiKey, {}, alunoToken),

  sendTicketMensagem: (
    apiKey: string,
    alunoToken: string,
    ticketId: string,
    mensagem: string
  ) =>
    request<{ ok: boolean; message_id: string; message: TicketMensagem }>(
      `/suporte/tickets/${ticketId}/mensagens`,
      apiKey,
      { method: "POST", body: JSON.stringify({ mensagem }) },
      alunoToken
    ),

  // ── Device Push Tokens ──

  registerDevice: (
    apiKey: string,
    alunoToken: string,
    deviceId: string,
    platform: "android" | "ios",
    pushToken?: string
  ) =>
    request<{ ok: boolean }>(
      "/devices/register",
      apiKey,
      {
        method: "POST",
        body: JSON.stringify({
          token: alunoToken,
          device_id: deviceId,
          platform,
          ...(pushToken ? { push_token: pushToken } : {}),
        }),
      },
      alunoToken
    ),
};
