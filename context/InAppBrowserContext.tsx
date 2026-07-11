import { Feather } from "@expo/vector-icons";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { useColors } from "@/hooks/useColors";

interface InAppBrowserContextType {
  openUrl: (url: string, title?: string) => void;
}

const InAppBrowserContext = createContext<InAppBrowserContextType>({
  openUrl: () => {},
});

export function useInAppBrowser() {
  return useContext(InAppBrowserContext);
}

// URLs that must open externally (not handled by the in-app browser)
function isExternalOnly(url: string): boolean {
  if (!url) return true;
  if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("whatsapp:")) return true;
  try {
    const { hostname } = new URL(url);
    if (hostname === "wa.me" || hostname === "api.whatsapp.com") return true;
  } catch {}
  return false;
}

// ── InAppBrowser modal ──────────────────────────────────────────────────────

function InAppBrowserModal({
  url,
  title,
  onClose,
}: {
  url: string;
  title?: string;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [currentUrl, setCurrentUrl] = useState(url);
  const [displayTitle, setDisplayTitle] = useState(title ?? "");
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  function animateProgress(toValue: number) {
    Animated.timing(progress, {
      toValue,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }

  function handleLoadStart() {
    setLoading(true);
    animateProgress(0.3);
  }

  function handleLoadProgress({ nativeEvent }: any) {
    animateProgress(nativeEvent.progress);
  }

  function handleLoadEnd() {
    setLoading(false);
    animateProgress(1);
    setTimeout(() => progress.setValue(0), 400);
  }

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const domain = (() => {
    try { return new URL(currentUrl).hostname.replace(/^www\./, ""); } catch { return currentUrl; }
  })();

  // ── Web render (iframe) ─────────────────────────────────────────────────

  if (Platform.OS === "web") {
    return (
      <View style={[StyleSheet.absoluteFillObject, styles.webOverlay]}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, paddingTop: 16 },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
              <Feather name="x" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <View style={[styles.urlBar, { backgroundColor: colors.muted }]}>
              <Feather name="lock" size={11} color={colors.mutedForeground} style={{ marginRight: 4 }} />
              <Text style={[styles.urlText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {domain}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
              }}
            >
              <Feather name="refresh-cw" size={17} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          {/* iframe */}
          <iframe
            ref={iframeRef as any}
            src={url}
            style={{ flex: 1, border: "none", width: "100%", height: "100%" } as any}
          />
        </View>
      </View>
    );
  }

  // ── Native render (WebView + Modal) ────────────────────────────────────

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Safe area top */}
        <View style={{ height: insets.top, backgroundColor: colors.card }} />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => webRef.current?.goBack()}
            disabled={!canGoBack}
          >
            <Feather name="chevron-left" size={22} color={canGoBack ? colors.foreground : colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => webRef.current?.goForward()}
            disabled={!canGoForward}
          >
            <Feather name="chevron-right" size={22} color={canGoForward ? colors.foreground : colors.mutedForeground} />
          </TouchableOpacity>

          <View style={[styles.urlBar, { backgroundColor: colors.muted, flex: 1 }]}>
            {loading ? (
              <ActivityIndicator size={12} color={colors.primary} style={{ marginRight: 5 }} />
            ) : (
              <Feather name="lock" size={11} color={colors.mutedForeground} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.urlText, { color: colors.foreground }]} numberOfLines={1}>
              {displayTitle || domain}
            </Text>
          </View>

          <TouchableOpacity style={styles.iconBtn} onPress={() => webRef.current?.reload()}>
            <Feather name="refresh-cw" size={17} color={colors.foreground} />
          </TouchableOpacity>

          <Pressable style={[styles.closeBtn, { backgroundColor: colors.primary }]} onPress={onClose}>
            <Text style={styles.closeBtnText}>Fechar</Text>
          </Pressable>
        </View>

        {/* Progress bar */}
        {loading && (
          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressBar, { backgroundColor: colors.primary, width: progressWidth }]}
            />
          </View>
        )}

        {/* WebView */}
        <WebView
          ref={webRef}
          source={{ uri: currentUrl }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          onLoadStart={handleLoadStart}
          onLoadProgress={handleLoadProgress}
          onLoadEnd={handleLoadEnd}
          onNavigationStateChange={(navState) => {
            setCurrentUrl(navState.url);
            if (navState.title) setDisplayTitle(navState.title);
            setCanGoBack(navState.canGoBack);
            setCanGoForward(navState.canGoForward);
          }}
        />

        {/* Safe area bottom */}
        <View style={{ height: insets.bottom, backgroundColor: colors.card }} />
      </View>
    </Modal>
  );
}

// ── Provider ────────────────────────────────────────────────────────────────

interface BrowserState { url: string; title?: string }

export function InAppBrowserProvider({ children }: { children: React.ReactNode }) {
  const [browser, setBrowser] = useState<BrowserState | null>(null);

  const openUrl = useCallback((url: string, title?: string) => {
    if (!url) return;
    if (isExternalOnly(url)) {
      const { Linking } = require("react-native");
      Linking.openURL(url).catch(() => {});
      return;
    }
    setBrowser({ url, title });
  }, []);

  const close = useCallback(() => setBrowser(null), []);

  return (
    <InAppBrowserContext.Provider value={{ openUrl }}>
      {children}
      {browser && (
        <InAppBrowserModal url={browser.url} title={browser.title} onClose={close} />
      )}
    </InAppBrowserContext.Provider>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  webOverlay: {
    zIndex: 9999,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    height: "90%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    display: "flex" as any,
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  urlBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flex: 1,
  },
  urlText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  progressTrack: {
    height: 2,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  progressBar: { height: 2 },
});
