import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { YoutubePlayerCustom } from "@/components/YoutubePlayerCustom";
import Markdown from "react-native-markdown-display";

import { useAuth } from "@/context/AuthContext";
import { useInAppBrowser } from "@/context/InAppBrowserContext";
import { useColors } from "@/hooks/useColors";
import { averonApi, Aula, Anexo, Modulo } from "@/services/averon";
import { getLesson, getCursoCache, setLesson } from "@/stores/lessonCache";

const COMPLETED_KEY = "averon_completed_lessons";

async function getCompleted(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function markCompleted(id: string): Promise<boolean> {
  const list = await getCompleted();
  if (list.includes(id)) return false;
  await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify([...list, id]));
  return true;
}

function formatDuration(seg: number): string {
  if (!seg) return "";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m > 0 ? `${m}min${s > 0 ? ` ${s}s` : ""}` : `${s}s`;
}

function formatLiberaEm(disponivel_em: string | null | undefined): string {
  if (!disponivel_em) return "Em breve";
  const ms = new Date(disponivel_em).getTime() - Date.now();
  if (ms <= 0) return "Em breve";
  const dias = Math.floor(ms / 86400000);
  const horas = Math.floor((ms % 86400000) / 3600000);
  if (dias > 0) return `Libera em ${dias} dia${dias !== 1 ? "s" : ""}`;
  if (horas > 0) return `Libera em ${horas}h`;
  const min = Math.floor((ms % 3600000) / 60000);
  return `Libera em ${min > 0 ? `${min}min` : "instantes"}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tipoIcon(tipo: string): "play" | "file-text" | "align-left" | "code" | "image" {
  if (tipo === "pdf") return "file-text";
  if (tipo === "texto") return "align-left";
  if (tipo === "html") return "code";
  if (tipo === "figurinhas") return "image";
  return "play";
}

function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}


function tipoLabel(tipo: string): string {
  if (tipo === "pdf") return "PDF";
  if (tipo === "texto") return "Texto";
  if (tipo === "html") return "HTML";
  if (tipo === "figurinhas") return "Figurinhas";
  return "Vídeo";
}

export default function LessonScreen() {
  const { id, titulo, conteudo_tipo } = useLocalSearchParams<{
    id: string;
    titulo: string;
    conteudo_tipo: string;
  }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { aluno, apiKey, alunoToken } = useAuth();
  const { openUrl } = useInAppBrowser();

  const { width: screenWidth } = useWindowDimensions();
  const [completed, setCompleted] = useState(false);
  const [completedList, setCompletedList] = useState<string[]>([]);
  const [xpGained, setXpGained] = useState<number | null>(null);
  const [newConquista, setNewConquista] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [expandedModulos, setExpandedModulos] = useState<Set<string>>(new Set());
  const [htmlHeight, setHtmlHeight] = useState(400);
  const xpAnim = useRef(new Animated.Value(0)).current;

  // ── Sticker lightbox state ────────────────────────────────
  const [stickerIndex, setStickerIndex] = useState<number | null>(null);
  const [downloadingAnexo, setDownloadingAnexo] = useState<number | null>(null);
  const [savingSticker, setSavingSticker] = useState<number | null>(null);
  const [sharingSticker, setSharingSticker] = useState<number | null>(null);
  const [savedStickers, setSavedStickers] = useState<Set<number>>(new Set());
  const [copiedStickers, setCopiedStickers] = useState<Set<number>>(new Set());
  const [copyingSticker, setCopyingSticker] = useState<number | null>(null);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

  // Listen for height postMessages from the HTML iframe (web only)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "htmlHeight" && typeof e.data.h === "number" && e.data.h > 50) {
        setHtmlHeight(e.data.h + 32);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 20;
  const isWeb = Platform.OS === "web";

  const cached = id ? getLesson(id) : null;
  const cursoCache = getCursoCache();
  const decodedTitle = titulo ? decodeURIComponent(titulo) : (cached?.titulo ?? "Aula");

  // Use normalized conteudo object with fallback to top-level fields
  const c = cached?.conteudo ?? {};
  const tipo = (c.tipo ?? cached?.conteudo_tipo ?? conteudo_tipo ?? "video") as
    "video" | "pdf" | "texto" | "html" | "figurinhas";
  const videoUrl = c.video_url ?? cached?.video_url ?? null;
  const conteudoUrl = c.pdf_url ?? cached?.pdf_url ?? cached?.conteudo_url ?? null;
  const conteudoTexto = c.texto ?? cached?.texto ?? cached?.conteudo_texto ?? null;
  const htmlContent = c.html ?? cached?.html ?? cached?.conteudo_texto ?? null;
  const stickers: string[] = c.stickers ?? cached?.stickers ?? [];
  const capaUrl = cached?.capa_url ?? null;
  const duracaoSeg = cached?.duracao_seg ?? 0;
  const descricao = cached?.descricao ?? null;
  const anexos = cached?.anexos ?? [];
  // embed_url / player_url = ready-to-use player URL for any provider (vimeo, youtube, embed)
  const embedUrl = c.embed_url ?? c.player_url ?? cached?.embed_url ?? cached?.player_url ?? null;
  const videoProvider = c.video_provider ?? cached?.video_provider ?? null;
  const youtubeId = c.youtube_id ?? cached?.youtube_id ?? extractYoutubeId(embedUrl);

  useEffect(() => {
    if (!id) return;
    getCompleted().then((list) => {
      setCompleted(list.includes(id));
      setCompletedList(list);
    });

    // Auto-expand the module that contains the current lesson
    if (cursoCache?.modulos) {
      for (const m of cursoCache.modulos) {
        if (m.aulas?.some((a) => a.id === id)) {
          setExpandedModulos(new Set([m.id]));
          break;
        }
      }
    }
  }, [id]);

  function toggleModulo(mid: string) {
    setExpandedModulos((prev) => {
      const next = new Set(prev);
      next.has(mid) ? next.delete(mid) : next.add(mid);
      return next;
    });
  }

  function goToLesson(aula: Aula) {
    if (aula.id === id) return;
    if (aula.disponivel === false) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const curso = getCursoCache();
    setLesson(aula, curso ?? undefined);
    router.replace(
      `/lesson/${aula.id}?titulo=${encodeURIComponent(aula.titulo)}&conteudo_tipo=${aula.conteudo_tipo ?? "video"}`
    );
  }

  async function awardPoints() {
    if (!id || !apiKey || !aluno?.id) return;
    const isNew = await markCompleted(id);
    if (!isNew) return;

    try {
      const minutos = duracaoSeg > 0 ? Math.ceil(duracaoSeg / 60) : 5;
      const res = await averonApi.postEvento(
        apiKey,
        aluno.id,
        "watch_lesson",
        { aula_id: id, minutos }
      );
      setXpGained(res.pontos_ganhos || 0);
      setCompleted(true);
      setCompletedList((prev) => [...prev, id]);

      if (res.novas_conquistas?.length) {
        setNewConquista(
          res.novas_conquistas.map((c) => `${c.icone} ${c.titulo}`).join("\n")
        );
      }

      const list = await getCompleted();
      if (list.length === 1) {
        averonApi.postEvento(apiKey, aluno.id, "complete_course").catch(() => {});
      }

      Animated.sequence([
        Animated.spring(xpAnim, { toValue: 1, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(xpAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => { setXpGained(null); setNewConquista(null); });
    } catch {}
  }

  function fireDownloadEvento() {
    if (!apiKey || !aluno?.id) return;
    averonApi.postEvento(apiKey, aluno.id, "download_file").catch(() => {});
  }

  async function downloadAnexo(url: string, titulo: string, index: number) {
    if (downloadingAnexo !== null) return;
    setDownloadingAnexo(index);
    try {
      const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "bin";
      const safeName = titulo.replace(/[^a-zA-Z0-9._\-]/g, "_").slice(0, 60);
      const dest = `${FileSystem.cacheDirectory}${safeName}.${ext}`;
      const { uri } = await FileSystem.downloadAsync(url, dest);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { dialogTitle: titulo });
      } else {
        await Linking.openURL(url);
      }
      fireDownloadEvento();
    } catch {
      Alert.alert("Erro", "Não foi possível baixar o arquivo. Tente novamente.");
    } finally {
      setDownloadingAnexo(null);
    }
  }

  function handlePlayerLoad() {
    if (!playerReady) {
      setPlayerReady(true);
      awardPoints();
    }
  }

  const xpScale = xpAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  // ── Player ────────────────────────────────────────────────
  // API returns embed_url ready-to-use for all providers (vimeo / youtube / embed).
  // Rule: always use embed_url — never try to construct it ourselves.
  //
  // Provider-specific WebView needs:
  //   vimeo  → defaults are fine (player.vimeo.com accepts any UA)
  //   youtube → youtube-nocookie.com rejects non-browser UA — must spoof Chrome
  //   embed  → Panda/Bunny/Wistia/Loom need thirdPartyCookiesEnabled + hardware layer

  // Mobile Chrome UA — required for YouTube embed to not show "browser not supported"
  const CHROME_UA =
    "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

  function renderVideoPlayer() {
    if (!embedUrl && !videoUrl) return null;

    // No embed_url → open sharing URL in device browser as fallback
    if (!embedUrl) {
      return (
        <TouchableOpacity
          style={[styles.fallbackCard, { backgroundColor: colors.primary }]}
          onPress={() => Linking.openURL(videoUrl!).then(() => awardPoints()).catch(() => {})}
        >
          {capaUrl ? (
            <Image source={{ uri: capaUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : null}
          <View style={styles.fallbackOverlay}>
            <View style={styles.playCircle}>
              <Feather name="play" size={38} color="#fff" />
            </View>
            <Text style={styles.fallbackLabel}>Abrir vídeo externamente</Text>
          </View>
        </TouchableOpacity>
      );
    }

    const isYoutube =
      videoProvider === "youtube" ||
      embedUrl.includes("youtube") ||
      embedUrl.includes("youtu.be") ||
      !!youtubeId;
    const isEmbed = videoProvider === "embed";

    if (isWeb) {
      return (
        <View style={styles.playerWrap}>
          <iframe
            src={embedUrl}
            title={decodedTitle}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" } as any}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={handlePlayerLoad}
          />
        </View>
      );
    }

    // YouTube: custom WebView with youtube-nocookie.com + referrerpolicy.
    // Root cause of error 153: embedder.identity.missing.referrer — YouTube
    // requires a valid HTTP Referer. The custom component uses baseUrl set to
    // youtube-nocookie.com so WKWebView sends a proper Referer, and the iframe
    // sets referrerpolicy="strict-origin-when-cross-origin" to satisfy YouTube.
    if (isYoutube && youtubeId) {
      const playerHeight = Math.round(screenWidth * 9 / 16);
      return (
        <View style={styles.playerWrap}>
          <YoutubePlayerCustom
            videoId={youtubeId}
            height={playerHeight}
            onReady={handlePlayerLoad}
          />
        </View>
      );
    }

    return (
      <View style={styles.playerWrap}>
        <WebView
          source={{ uri: embedUrl }}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={["*"]}
          // Embed providers (Panda, Bunny…) need browser UA + third-party cookies.
          userAgent={isEmbed ? CHROME_UA : undefined}
          thirdPartyCookiesEnabled
          mixedContentMode={isEmbed ? "always" : "never"}
          androidLayerType="hardware"
          style={{ flex: 1, backgroundColor: "#000" }}
          onLoad={handlePlayerLoad}
        />
      </View>
    );
  }

  function renderPdfPlayer() {
    if (!conteudoUrl) return (
      <View style={[styles.noContent, { backgroundColor: colors.muted }]}>
        <Feather name="file-text" size={32} color={colors.mutedForeground} />
        <Text style={[styles.noContentText, { color: colors.mutedForeground }]}>PDF não disponível</Text>
      </View>
    );

    if (isWeb) {
      return (
        <View style={{ width: "100%", height: 500 }}>
          <iframe
            src={conteudoUrl}
            title={decodedTitle}
            style={{ width: "100%", height: "100%", border: "none", borderRadius: 12 } as any}
          />
        </View>
      );
    }

    return (
      <View style={styles.playerWrap}>
        <WebView
          source={{ uri: conteudoUrl }}
          style={{ flex: 1 }}
          onLoad={handlePlayerLoad}
        />
      </View>
    );
  }

  function renderHtmlPlayer() {
    if (!htmlContent) return (
      <View style={[styles.noContent, { backgroundColor: colors.muted }]}>
        <Feather name="code" size={32} color={colors.mutedForeground} />
        <Text style={[styles.noContentText, { color: colors.mutedForeground }]}>Conteúdo HTML não disponível</Text>
      </View>
    );

    if (isWeb) {
      // On web, resize the iframe to fit its content via postMessage from inside
      return (
        <View style={{ width: "100%" }}>
          <iframe
            srcDoc={`${htmlContent}<script>
              function sendHeight(){parent.postMessage({type:'htmlHeight',h:document.body.scrollHeight},'*');}
              window.addEventListener('load',sendHeight);
              new MutationObserver(sendHeight).observe(document.body,{childList:true,subtree:true,attributes:true});
            </script>`}
            title={decodedTitle}
            style={{ width: "100%", height: htmlHeight, border: "none", borderRadius: 12, display: "block" } as any}
            scrolling="no"
            onLoad={(e: any) => {
              handlePlayerLoad();
              // Fallback: try to read iframe body height directly
              try {
                const h = (e.target as HTMLIFrameElement).contentDocument?.body?.scrollHeight;
                if (h && h > 0) setHtmlHeight(h);
              } catch {}
            }}
            sandbox="allow-scripts allow-same-origin"
          />
        </View>
      );
    }

    // Native: WebView with scroll disabled + JS injection to measure real content height
    const injectedJS = `
      (function(){
        function sendHeight(){
          var h = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight
          );
          window.ReactNativeWebView.postMessage(String(h));
        }
        window.addEventListener('load', sendHeight);
        setTimeout(sendHeight, 300);
        setTimeout(sendHeight, 800);
        new MutationObserver(sendHeight).observe(document.body, {childList:true,subtree:true,attributes:true});
      })();
      true;
    `;

    return (
      <View style={{ width: "100%", height: htmlHeight }}>
        <WebView
          source={{ html: htmlContent }}
          javaScriptEnabled
          scrollEnabled={false}
          injectedJavaScript={injectedJS}
          onMessage={(e) => {
            const h = parseInt(e.nativeEvent.data, 10);
            if (!isNaN(h) && h > 50) setHtmlHeight(h + 32);
          }}
          onLoad={handlePlayerLoad}
          style={{ width: "100%", height: "100%" }}
        />
      </View>
    );
  }

  // ── Sticker helpers ──────────────────────────────────────
  // Download a remote sticker to a local temp file using FileSystem.downloadAsync.
  // Simpler and more reliable than ImageManipulator for remote URLs.
  async function fetchStickerLocal(url: string): Promise<string> {
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "png";
    const dest = `${FileSystem.cacheDirectory}sticker_${Date.now()}.${ext}`;
    const result = await FileSystem.downloadAsync(url, dest);
    return result.uri;
  }

  // ── Sticker save / share ─────────────────────────────────
  async function saveSticker(url: string, index: number) {
    if (savingSticker !== null) return;
    setSavingSticker(index);
    try {
      if (Platform.OS === "web") {
        const a = document.createElement("a");
        a.href = url;
        a.download = `figurinha_${index + 1}.png`;
        a.target = "_blank";
        a.click();
        setSavedStickers((prev) => new Set([...prev, index]));
        return;
      }
      if (!mediaPermission?.granted) {
        const perm = await requestMediaPermission();
        if (!perm.granted) {
          Alert.alert("Permissão necessária", "Autorize o acesso à galeria para salvar a figurinha.");
          return;
        }
      }
      const localUri = await fetchStickerLocal(url);
      await MediaLibrary.saveToLibraryAsync(localUri);
      setSavedStickers((prev) => new Set([...prev, index]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      const msg = String(e?.message ?? "").toLowerCase();
      if (msg.includes("permission") || msg.includes("media library") || msg.includes("medialibrary")) {
        Alert.alert("Permissão necessária", "Autorize o acesso à galeria nas configurações do dispositivo.");
      } else {
        // Fallback: share so user can save manually
        try {
          const localUri = await fetchStickerLocal(url);
          await Sharing.shareAsync(localUri, { mimeType: "image/png", UTI: "public.png" });
        } catch {
          Alert.alert("Erro ao salvar", "Não foi possível salvar a figurinha na galeria.");
        }
      }
    } finally {
      setSavingSticker(null);
    }
  }

  async function shareSticker(url: string, index: number) {
    if (sharingSticker !== null) return;
    if (Platform.OS === "web") { window.open(url, "_blank"); return; }
    setSharingSticker(index);
    try {
      const localUri = await fetchStickerLocal(url);
      await Sharing.shareAsync(localUri, { mimeType: "image/png", UTI: "public.png" });
    } catch {
      Alert.alert("Erro ao enviar", "Não foi possível compartilhar a figurinha.");
    } finally {
      setSharingSticker(null);
    }
  }

  async function copySticker(url: string, index: number) {
    if (copyingSticker !== null) return;
    setCopyingSticker(index);
    try {
      if (Platform.OS === "web") {
        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          await (navigator.clipboard as any).write([
            new ClipboardItem({ [blob.type]: blob }),
          ]);
        } catch {
          window.open(url, "_blank");
        }
        setCopiedStickers((prev) => new Set([...prev, index]));
        return;
      }
      // Native: download PNG → try clipboard → fallback to share sheet
      const localUri = await fetchStickerLocal(url);
      let clipOk = false;
      try {
        const base64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Clipboard.setImageAsync(base64);
        clipOk = true;
      } catch (clipErr: any) {
        console.warn("[copySticker] clipboard failed:", clipErr?.message ?? clipErr);
      }

      if (clipOk) {
        setCopiedStickers((prev) => new Set([...prev, index]));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          setCopiedStickers((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        }, 3000);
      } else {
        // Clipboard not available (Expo Go) — open native share sheet so user can tap Copy
        await Sharing.shareAsync(localUri, { mimeType: "image/png", UTI: "public.png" });
        setCopiedStickers((prev) => new Set([...prev, index]));
        setTimeout(() => {
          setCopiedStickers((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        }, 3000);
      }
    } catch (e: any) {
      console.error("[copySticker] error:", e?.message ?? e);
      Alert.alert("Erro ao copiar", String(e?.message ?? e ?? "desconhecido"));
    } finally {
      setCopyingSticker(null);
    }
  }

  function renderFigurinhas() {
    const COLS = 3;
    const PADDING = 16;
    const GAP = 10;
    const CELL = (screenWidth - PADDING * 2 - GAP * (COLS - 1)) / COLS;

    if (!stickers.length) return (
      <View style={[styles.noContent, { backgroundColor: colors.muted }]}>
        <Feather name="image" size={32} color={colors.mutedForeground} />
        <Text style={[styles.noContentText, { color: colors.mutedForeground }]}>Sem figurinhas disponíveis</Text>
      </View>
    );

    return (
      <View style={{ paddingHorizontal: PADDING, paddingTop: 8, paddingBottom: 4 }}>
        {/* Pack header */}
        <View style={[styles.stickerPackHeader, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "25" }]}>
          <View style={[styles.stickerPackIconWrap, { backgroundColor: colors.primary + "20" }]}>
            <Text style={{ fontSize: 26 }}>🎨</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stickerPackTitle, { color: colors.foreground }]}>Pack de Figurinhas</Text>
            <Text style={[styles.stickerPackSub, { color: colors.mutedForeground }]}>
              {stickers.length} figurinha{stickers.length !== 1 ? "s" : ""} incluída{stickers.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={[styles.stickerCountBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.stickerCountText}>{stickers.length}</Text>
          </View>
        </View>

        {/* Hint */}
        <View style={styles.stickerHintRow}>
          <Feather name="info" size={11} color={colors.mutedForeground} />
          <Text style={[styles.stickerHintText, { color: colors.mutedForeground }]}>
            Toque para ver em tamanho real • Segure para salvar na galeria
          </Text>
        </View>

        {/* Grid */}
        <View style={[styles.stickerGridWrap, { gap: GAP }]}>
          {stickers.map((url, i) => {
            const isSaved = savedStickers.has(i);
            const isSaving = savingSticker === i;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.82}
                onPress={() => setStickerIndex(i)}
                onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); saveSticker(url, i); }}
                style={[
                  styles.stickerCard,
                  {
                    width: CELL,
                    height: CELL,
                    borderColor: isSaved ? "#10B981" + "70" : colors.border,
                    borderWidth: isSaved ? 2 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                {/* Checkered background (transparency indicator) */}
                <View style={[StyleSheet.absoluteFillObject, styles.stickerCheckerWrap]}>
                  {[0, 1, 2, 3].map((t) => (
                    <View
                      key={t}
                      style={{
                        position: "absolute",
                        left: t % 2 === 0 ? 0 : "50%",
                        top: t < 2 ? 0 : "50%",
                        width: "50%",
                        height: "50%",
                        backgroundColor: t % 2 === 0 ? "#E5E5E5" : "#F5F5F5",
                      } as any}
                    />
                  ))}
                </View>

                <Image
                  source={{ uri: url }}
                  style={{ width: CELL - 16, height: CELL - 16 }}
                  resizeMode="contain"
                />

                {/* Status badge */}
                {isSaving ? (
                  <View style={[styles.stickerBadge, { backgroundColor: colors.primary }]}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                ) : isSaved ? (
                  <View style={[styles.stickerBadge, { backgroundColor: "#10B981" }]}>
                    <Feather name="check" size={11} color="#fff" />
                  </View>
                ) : (
                  <View style={[styles.stickerBadge, { backgroundColor: "rgba(0,0,0,0.35)" }]}>
                    <Feather name="download" size={11} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* "Salvar todas" button */}
        {stickers.length > 1 && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.stickerSaveAllBtn, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}
            onPress={async () => {
              for (let i = 0; i < stickers.length; i++) {
                await saveSticker(stickers[i], i);
              }
            }}
          >
            <Feather name="download-cloud" size={16} color={colors.primary} />
            <Text style={[styles.stickerSaveAllText, { color: colors.primary }]}>
              Salvar todas na galeria
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Módulos / aulas panel ─────────────────────────────────

  function renderModulosPanel() {
    if (!cursoCache?.modulos?.length) return null;

    const totalAulas = cursoCache.modulos.reduce((acc, m) => acc + (m.aulas?.length ?? 0), 0);
    const totalDone = cursoCache.modulos.reduce(
      (acc, m) => acc + (m.aulas?.filter((a) => completedList.includes(a.id)).length ?? 0),
      0,
    );
    const overallProgress = totalAulas > 0 ? totalDone / totalAulas : 0;

    return (
      <View style={{ marginTop: 8 }}>

        {/* ── Section header ── */}
        <View style={styles.panelHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>Conteúdos</Text>
            <Text style={[styles.panelSub, { color: colors.mutedForeground }]}>
              {totalAulas} aula{totalAulas !== 1 ? "s" : ""}
              {cursoCache.modulos.length > 1
                ? `  ·  ${cursoCache.modulos.length} módulos`
                : ""}
            </Text>
          </View>
          {overallProgress > 0 && (
            <View style={[styles.panelProgressPill, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "25" }]}>
              <Text style={[styles.panelProgressText, { color: colors.primary }]}>
                {Math.round(overallProgress * 100)}%
              </Text>
            </View>
          )}
        </View>

        {/* ── Playlist container ── */}
        <View style={[styles.playlistContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {cursoCache.modulos
            .slice()
            .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
            .map((modulo, moduloIdx) => {
              const isExpanded = expandedModulos.has(modulo.id);
              const aulaCount = modulo.aulas?.length ?? 0;
              const completedCount = modulo.aulas?.filter((a) => completedList.includes(a.id)).length ?? 0;
              const progress = aulaCount > 0 ? completedCount / aulaCount : 0;
              const isDone = progress === 1 && aulaCount > 0;
              const isFirst = moduloIdx === 0;

              return (
                <View key={modulo.id}>
                  {/* Module section header */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleModulo(modulo.id)}
                    style={[
                      styles.moduloSectionHeader,
                      !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                      { backgroundColor: colors.muted + "60" },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.moduloTitulo, { color: colors.foreground }]} numberOfLines={2}>
                        {modulo.titulo}
                      </Text>
                      <Text style={[styles.moduloMeta, { color: colors.mutedForeground }]}>
                        {completedCount}/{aulaCount} aula{aulaCount !== 1 ? "s" : ""}
                        {isDone ? "  ✓" : progress > 0 ? `  · ${Math.round(progress * 100)}%` : ""}
                      </Text>
                    </View>
                    {/* Mini progress bar + chevron */}
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <Feather
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={15}
                        color={colors.mutedForeground}
                      />
                      {aulaCount > 0 && (
                        <View style={[styles.miniBar, { backgroundColor: colors.border }]}>
                          <View
                            style={[
                              styles.miniBarFill,
                              {
                                backgroundColor: isDone ? "#10B981" : colors.primary,
                                width: `${Math.max(progress * 100, progress > 0 ? 8 : 0)}%` as any,
                              },
                            ]}
                          />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Aulas list */}
                  {isExpanded && (modulo.aulas ?? [])
                    .slice()
                    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
                    .map((aula, idx) => {
                      const isCurrent = aula.id === id;
                      const isDoneAula = completedList.includes(aula.id);
                      const isLocked = aula.disponivel === false;

                      if (isLocked) {
                        return (
                          <View
                            key={aula.id}
                            style={[
                              styles.aulaRow,
                              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, opacity: 0.45 },
                            ]}
                          >
                            <Feather name="lock" size={13} color={colors.mutedForeground} style={{ marginTop: 1 }} />
                            <View style={{ flex: 1, gap: 1 }}>
                              <Text style={[styles.aulaTitulo, { color: colors.mutedForeground }]} numberOfLines={2}>
                                {aula.titulo}
                              </Text>
                              <Text style={[styles.aulaMetaText, { color: colors.mutedForeground }]}>
                                {formatLiberaEm(aula.disponivel_em)}
                              </Text>
                            </View>
                          </View>
                        );
                      }

                      return (
                        <TouchableOpacity
                          key={aula.id}
                          activeOpacity={0.7}
                          onPress={() => goToLesson(aula)}
                          style={[
                            styles.aulaRow,
                            { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                            isCurrent && { backgroundColor: colors.primary + "0D", borderLeftWidth: 3, borderLeftColor: colors.primary },
                          ]}
                        >
                          {/* State icon */}
                          <View style={[
                            styles.aulaStateIcon,
                            {
                              backgroundColor: isCurrent
                                ? colors.primary
                                : isDoneAula
                                ? "#10B981"
                                : aula.gratis_cadastro
                                ? "#10B98120"
                                : colors.muted,
                            },
                          ]}>
                            {isCurrent
                              ? <Feather name={tipoIcon(aula.conteudo_tipo)} size={10} color="#fff" />
                              : isDoneAula
                              ? <Feather name="check" size={10} color="#fff" />
                              : aula.gratis_cadastro
                              ? <Feather name="gift" size={10} color="#10B981" />
                              : <Text style={[styles.aulaNumText, { color: colors.mutedForeground }]}>{idx + 1}</Text>
                            }
                          </View>

                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={[
                                styles.aulaTitulo,
                                {
                                  color: isCurrent ? colors.primary : colors.foreground,
                                  fontFamily: isCurrent ? "Inter_600SemiBold" : "Inter_400Regular",
                                  opacity: isDoneAula && !isCurrent ? 0.55 : 1,
                                },
                              ]}
                              numberOfLines={2}
                            >
                              {aula.titulo}
                            </Text>
                            <View style={styles.aulaMetaRow}>
                              {aula.gratis_cadastro && !isCurrent && (
                                <View style={{ backgroundColor: "#10B98118", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                  <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#10B981" }}>Grátis</Text>
                                </View>
                              )}
                              <Feather name={tipoIcon(aula.conteudo_tipo)} size={10} color={colors.mutedForeground} />
                              <Text style={[styles.aulaMetaText, { color: colors.mutedForeground }]}>
                                {tipoLabel(aula.conteudo_tipo)}
                                {aula.duracao_seg > 0 ? ` · ${formatDuration(aula.duracao_seg)}` : ""}
                              </Text>
                            </View>
                          </View>

                          {isCurrent ? (
                            <View style={[styles.currentBadge, { backgroundColor: colors.primary + "18" }]}>
                              <Text style={[styles.currentBadgeText, { color: colors.primary }]}>Agora</Text>
                            </View>
                          ) : isDoneAula ? (
                            <Feather name="check-circle" size={14} color="#10B981" style={{ opacity: 0.65 }} />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })
                  }
                </View>
              );
            })}
        </View>
      </View>
    );
  }

  // Hide the "Conteúdo do curso" panel when there is exactly 1 module + 1 lesson
  // and the lesson is HTML or texto (PDF already uses a fullscreen layout that omits it).
  const isSingleLessonNonVideo =
    (cursoCache?.modulos?.length ?? 0) === 1 &&
    (cursoCache?.modulos?.[0]?.aulas?.length ?? 0) === 1 &&
    (tipo === "html" || tipo === "texto");

  // ── PDF fullscreen render ─────────────────────────────────
  if (tipo === "pdf") {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {/* Floating back button */}
        <TouchableOpacity
          style={[styles.pdfBackBtn, { top: topPad + 10, backgroundColor: "rgba(0,0,0,0.55)" }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>

        {conteudoUrl ? (
          isWeb ? (
            <iframe
              src={conteudoUrl}
              title={decodedTitle}
              style={{ width: "100%", height: "100%", border: "none" } as any}
            />
          ) : (
            <WebView
              source={{ uri: conteudoUrl }}
              style={{ flex: 1 }}
              onLoad={handlePlayerLoad}
              allowsInlineMediaPlayback
              scalesPageToFit={false}
            />
          )
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Feather name="file-text" size={44} color="#555" />
            <Text style={{ color: "#777", marginTop: 12, fontSize: 15, fontFamily: "Inter_400Regular" }}>
              PDF não disponível
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {xpGained !== null && (
        <Animated.View style={[styles.xpToast, { opacity: xpAnim, transform: [{ scale: xpScale }] }]}>
          <Text style={styles.xpToastText}>⚡ +{xpGained} XP ganhos!</Text>
        </Animated.View>
      )}
      {newConquista && (
        <Animated.View style={[styles.conquistaToast, { opacity: xpAnim }]}>
          <Text style={styles.conquistaToastText}>Conquista: {newConquista}</Text>
        </Animated.View>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {decodedTitle}
        </Text>
        {completed && (
          <View style={[styles.completedBadge, { backgroundColor: "#10B981" + "18" }]}>
            <Feather name="check-circle" size={14} color="#10B981" />
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* ── Content area ── */}
        {tipo === "video" && renderVideoPlayer()}
        {tipo === "pdf" && renderPdfPlayer()}
        {tipo === "html" && renderHtmlPlayer()}
        {tipo === "figurinhas" && renderFigurinhas()}
        {tipo === "texto" && capaUrl && !conteudoTexto && (
          <Image source={{ uri: capaUrl }} style={styles.aulaCapaImg} resizeMode="cover" />
        )}

        {!isSingleLessonNonVideo && (
        <View style={{ padding: 16, gap: 14 }}>
          {/* Title + meta */}
          <Text style={[styles.lessonTitle, { color: colors.foreground }]}>{decodedTitle}</Text>

          <View style={styles.metaRow}>
            {duracaoSeg > 0 && (
              <View style={[styles.metaChip, { backgroundColor: colors.muted }]}>
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {formatDuration(duracaoSeg)}
                </Text>
              </View>
            )}
            <View style={[styles.metaChip, { backgroundColor: colors.muted }]}>
              <Feather
                name={tipoIcon(tipo) as any}
                size={12}
                color={colors.mutedForeground}
              />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {tipoLabel(tipo)}
              </Text>
            </View>
            {completed && (
              <View style={[styles.metaChip, { backgroundColor: "#10B981" + "15" }]}>
                <Feather name="check" size={12} color="#10B981" />
                <Text style={[styles.metaText, { color: "#10B981" }]}>Concluída</Text>
              </View>
            )}
          </View>

          {/* Descrição */}
          {descricao ? (
            <Text style={[styles.descricao, { color: colors.mutedForeground }]}>{descricao}</Text>
          ) : null}

          {/* Gamification banner */}
          {!completed ? (
            <View style={[styles.gamifBanner, { backgroundColor: colors.primary + "0D", borderColor: colors.primary + "30" }]}>
              <Text style={{ fontSize: 18 }}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.gamifTitle, { color: colors.foreground }]}>Ganhe XP ao concluir</Text>
                <Text style={[styles.gamifDesc, { color: colors.mutedForeground }]}>
                  Complete esta aula e acumule XP no ranking.
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.gamifBanner, { backgroundColor: "#10B981" + "10", borderColor: "#10B981" + "30" }]}>
              <Feather name="check-circle" size={20} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.gamifTitle, { color: colors.foreground }]}>Aula concluída!</Text>
                <Text style={[styles.gamifDesc, { color: colors.mutedForeground }]}>Continue estudando!</Text>
              </View>
            </View>
          )}

          {/* ── Texto/markdown ── */}
          {tipo === "texto" && conteudoTexto ? (
            <View style={[styles.textoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Markdown
                style={{
                  body: { color: colors.foreground, fontSize: 15, lineHeight: 24, fontFamily: "Inter_400Regular" },
                  heading1: { color: colors.foreground, fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 8, marginTop: 4 },
                  heading2: { color: colors.foreground, fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 6, marginTop: 4 },
                  heading3: { color: colors.foreground, fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 4, marginTop: 4 },
                  strong: { fontFamily: "Inter_700Bold" },
                  em: { fontStyle: "italic" },
                  code_inline: { backgroundColor: colors.muted, color: colors.primary, borderRadius: 4, paddingHorizontal: 4, fontFamily: "Inter_400Regular" },
                  fence: { backgroundColor: colors.muted, borderRadius: 8, padding: 12 },
                  code_block: { backgroundColor: colors.muted, borderRadius: 8, padding: 12, color: colors.foreground },
                  bullet_list_icon: { color: colors.primary },
                  ordered_list_icon: { color: colors.primary },
                  link: { color: colors.primary },
                  blockquote: { backgroundColor: colors.muted, borderLeftColor: colors.primary, borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 4 },
                  hr: { backgroundColor: colors.border },
                }}
              >
                {conteudoTexto}
              </Markdown>
              {!completed && (
                <TouchableOpacity
                  style={[styles.textoBtn, { backgroundColor: colors.primary }]}
                  onPress={() => { awardPoints(); }}
                >
                  <Feather name="check" size={16} color="#fff" />
                  <Text style={styles.textoBtnText}>Marcar como lida</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* ── PDF download button ── */}
          {tipo === "pdf" && conteudoUrl ? (
            <TouchableOpacity
              style={[styles.downloadBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => { openUrl(conteudoUrl!); fireDownloadEvento(); }}
            >
              <Feather name="download" size={18} color={colors.primary} />
              <Text style={[styles.downloadBtnText, { color: colors.primary }]}>Baixar PDF</Text>
            </TouchableOpacity>
          ) : null}

          {/* ── Anexos ── */}
          {anexos.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={[styles.anexosTitle, { color: colors.foreground }]}>
                📎 Materiais de apoio
              </Text>
              {anexos
                .sort((a, b) => a.ordem - b.ordem)
                .map((anexo, idx) => {
                  const isDownloading = downloadingAnexo === idx;
                  return (
                    <TouchableOpacity
                      key={anexo.id}
                      style={[styles.anexoItem, { backgroundColor: colors.card, borderColor: colors.border, opacity: isDownloading ? 0.6 : 1 }]}
                      onPress={() => downloadAnexo(anexo.file_url, anexo.titulo, idx)}
                      disabled={downloadingAnexo !== null}
                    >
                      <View style={[styles.anexoIcon, { backgroundColor: colors.primary + "18" }]}>
                        <Feather name="paperclip" size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.anexoTitulo, { color: colors.foreground }]} numberOfLines={1}>
                          {anexo.titulo}
                        </Text>
                        <Text style={[styles.anexoMeta, { color: colors.mutedForeground }]}>
                          {formatBytes(anexo.size_bytes)}
                        </Text>
                      </View>
                      {isDownloading
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Feather name="download" size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
            </View>
          )}

          {/* ── Separador + Módulos panel (hidden for single html/texto lesson) ── */}
          {!isSingleLessonNonVideo && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              {renderModulosPanel()}
            </>
          )}

          {/* Back button (only if no course data cached) */}
          {!cursoCache && (
            <TouchableOpacity
              style={[styles.backListBtn, { borderColor: colors.border }]}
              onPress={() => router.back()}
            >
              <Feather name="list" size={16} color={colors.foreground} />
              <Text style={[styles.backListText, { color: colors.foreground }]}>Voltar aos módulos</Text>
            </TouchableOpacity>
          )}
        </View>
        )}
      </ScrollView>

      {/* ── Sticker Lightbox Modal ─────────────────────────── */}
      <Modal
        visible={stickerIndex !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setStickerIndex(null)}
      >
        <View style={styles.lightboxOverlay}>
          {/* Close */}
          <TouchableOpacity style={styles.lightboxCloseBtn} onPress={() => setStickerIndex(null)}>
            <View style={styles.lightboxCloseBg}>
              <Feather name="x" size={20} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Counter */}
          {stickers.length > 1 && stickerIndex !== null && (
            <View style={styles.lightboxCounterWrap}>
              <Text style={styles.lightboxCounter}>{stickerIndex + 1} / {stickers.length}</Text>
            </View>
          )}

          {/* Sticker card */}
          {stickerIndex !== null && (
            <View style={styles.lightboxCard}>
              {/* Checkered bg */}
              <View style={[StyleSheet.absoluteFillObject, styles.stickerCheckerWrap]}>
                {[0, 1, 2, 3].map((t) => (
                  <View
                    key={t}
                    style={{
                      position: "absolute",
                      left: t % 2 === 0 ? 0 : "50%",
                      top: t < 2 ? 0 : "50%",
                      width: "50%",
                      height: "50%",
                      backgroundColor: t % 2 === 0 ? "#DCDCDC" : "#F0F0F0",
                    } as any}
                  />
                ))}
              </View>
              <Image
                source={{ uri: stickers[stickerIndex] }}
                style={{ width: 260, height: 260 }}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Navigation arrows */}
          {stickers.length > 1 && stickerIndex !== null && (
            <View style={styles.lightboxNavRow}>
              <TouchableOpacity
                style={[styles.lightboxNavBtn, { opacity: stickerIndex > 0 ? 1 : 0.25 }]}
                onPress={() => stickerIndex > 0 && setStickerIndex(stickerIndex - 1)}
              >
                <Feather name="chevron-left" size={26} color="#fff" />
              </TouchableOpacity>
              {/* Dots */}
              <View style={styles.lightboxDots}>
                {stickers.slice(0, Math.min(stickers.length, 10)).map((_, di) => (
                  <View
                    key={di}
                    style={[
                      styles.lightboxDot,
                      { opacity: di === stickerIndex ? 1 : 0.3, transform: [{ scale: di === stickerIndex ? 1.3 : 1 }] },
                    ]}
                  />
                ))}
              </View>
              <TouchableOpacity
                style={[styles.lightboxNavBtn, { opacity: stickerIndex < stickers.length - 1 ? 1 : 0.25 }]}
                onPress={() => stickerIndex < stickers.length - 1 && setStickerIndex(stickerIndex + 1)}
              >
                <Feather name="chevron-right" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Action buttons */}
          {stickerIndex !== null && (
            <View style={styles.lightboxActions}>
              {/* Copiar */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.lightboxBtnCopy,
                  copiedStickers.has(stickerIndex) && { backgroundColor: "#8B5CF6" },
                ]}
                onPress={() => copySticker(stickers[stickerIndex], stickerIndex)}
              >
                {copyingSticker === stickerIndex ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : copiedStickers.has(stickerIndex) ? (
                  <Feather name="check" size={16} color="#fff" />
                ) : (
                  <Feather name="copy" size={16} color="#fff" />
                )}
                <Text style={styles.lightboxBtnText}>
                  {copiedStickers.has(stickerIndex) ? "Copiado!" : "Copiar"}
                </Text>
              </TouchableOpacity>

              {/* Compartilhar */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.lightboxBtnShare}
                onPress={() => shareSticker(stickers[stickerIndex], stickerIndex)}
              >
                {sharingSticker === stickerIndex ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Feather name="share-2" size={16} color="#fff" />
                )}
                <Text style={styles.lightboxBtnText}>Enviar</Text>
              </TouchableOpacity>

              {/* Salvar */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.lightboxBtnSave,
                  savedStickers.has(stickerIndex) && { backgroundColor: "#10B981" },
                ]}
                onPress={() => saveSticker(stickers[stickerIndex], stickerIndex)}
              >
                {savingSticker === stickerIndex ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : savedStickers.has(stickerIndex) ? (
                  <Feather name="check" size={16} color="#fff" />
                ) : (
                  <Feather name="download" size={16} color="#fff" />
                )}
                <Text style={styles.lightboxBtnText}>
                  {savedStickers.has(stickerIndex) ? "Salvo!" : "Salvar"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  completedBadge: { padding: 6, borderRadius: 8 },
  xpToast: {
    position: "absolute", top: 100, alignSelf: "center", zIndex: 99,
    backgroundColor: "#F59E0B", paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 24, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8,
  },
  xpToastText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  conquistaToast: {
    position: "absolute", top: 152, alignSelf: "center", zIndex: 99,
    backgroundColor: "#7C3AED", paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 24, maxWidth: "85%",
  },
  conquistaToastText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  playerWrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", overflow: "hidden" },
  fallbackCard: { width: "100%", aspectRatio: 16 / 9, overflow: "hidden", position: "relative" },
  fallbackOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center", gap: 12,
  },
  playCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  fallbackLabel: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "Inter_500Medium" },
  aulaCapaImg: { width: "100%", height: 220 },
  noContent: {
    width: "100%", height: 140, alignItems: "center", justifyContent: "center", gap: 10,
  },
  noContentText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  lessonTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  descricao: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  metaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  metaText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  gamifBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  gamifTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 3 },
  gamifDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  textoCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 14 },
  textoContent: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24 },
  textoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 13, borderRadius: 12,
  },
  textoBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  pdfBackBtn: {
    position: "absolute", left: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  downloadBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  downloadBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  anexosTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  anexoItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  anexoIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  anexoTitulo: { fontSize: 14, fontFamily: "Inter_500Medium" },
  anexoMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth },
  backListBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  backListText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  // ── Sticker grid ──────────────────────────────────────────
  stickerPackHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10,
  },
  stickerPackIconWrap: {
    width: 50, height: 50, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  stickerPackTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  stickerPackSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  stickerCountBadge: {
    minWidth: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 8,
  },
  stickerCountText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  stickerHintRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginBottom: 14, paddingHorizontal: 2,
  },
  stickerHintText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  stickerGridWrap: {
    flexDirection: "row", flexWrap: "wrap",
  },
  stickerCard: {
    borderRadius: 16, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    elevation: 2,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  stickerCheckerWrap: { borderRadius: 16, overflow: "hidden" },
  stickerBadge: {
    position: "absolute", bottom: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  stickerSaveAllBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginTop: 14, paddingVertical: 13, borderRadius: 14, borderWidth: 1,
  },
  stickerSaveAllText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  // ── Sticker lightbox ──────────────────────────────────────
  lightboxOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center", justifyContent: "center",
  },
  lightboxCloseBtn: {
    position: "absolute", top: 52, right: 20, zIndex: 10,
  },
  lightboxCloseBg: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  lightboxCounterWrap: {
    position: "absolute", top: 60, left: 20,
  },
  lightboxCounter: {
    color: "rgba(255,255,255,0.7)", fontSize: 14, fontFamily: "Inter_500Medium",
  },
  lightboxCard: {
    width: 280, height: 280, borderRadius: 24, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    elevation: 10,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 20,
  },
  lightboxNavRow: {
    flexDirection: "row", alignItems: "center",
    width: "100%", paddingHorizontal: 20, marginTop: 28,
  },
  lightboxNavBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  lightboxDots: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  lightboxDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff",
  },
  lightboxActions: {
    flexDirection: "row", gap: 12, marginTop: 28, paddingHorizontal: 24, width: "100%",
  },
  lightboxBtnCopy: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 14, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  lightboxBtnShare: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 14, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  lightboxBtnSave: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 14, borderRadius: 16,
    backgroundColor: "#6366F1",
  },
  lightboxBtnText: {
    color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold",
  },
  // ── Módulos panel ──────────────────────────────
  panelHeader: {
    flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14,
  },
  panelTitle: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  panelSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  panelProgressPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  panelProgressDot: { width: 6, height: 6, borderRadius: 3 },
  panelProgressText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  playlistContainer: {
    borderRadius: 16, borderWidth: 1, overflow: "hidden", marginTop: 0,
  },
  moduloSectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  moduloTitulo: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  moduloMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  miniBar: {
    width: 52, height: 3, borderRadius: 2, overflow: "hidden",
  },
  miniBarFill: { height: "100%", borderRadius: 2 },
  aulaRow: {
    flexDirection: "row", alignItems: "center", gap: 11,
    paddingHorizontal: 14, paddingVertical: 12,
    borderLeftWidth: 3, borderLeftColor: "transparent",
  },
  aulaStateIcon: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  aulaNum: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  aulaNumText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  aulaTitulo: { fontSize: 13, lineHeight: 18 },
  aulaMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  aulaMetaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  currentBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  currentBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
});
