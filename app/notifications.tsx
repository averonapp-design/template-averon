import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useInAppBrowser } from "@/context/InAppBrowserContext";
import { useNotifications } from "@/context/NotificationContext";
import { useColors } from "@/hooks/useColors";
import { averonApi, Notificacao } from "@/services/averon";

const isExpoGo = Constants.executionEnvironment === "storeClient";

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "Agora mesmo";
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d atrás`;
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTipoConfig(tipo: string | null | undefined, colors: ReturnType<typeof useColors>) {
  switch (tipo) {
    case "sucesso":
    case "success":
      return { color: colors.success, icon: "check-circle" };
    case "alerta":
    case "warning":
      return { color: colors.warning, icon: "alert-triangle" };
    case "erro":
    case "error":
      return { color: "#EF4444", icon: "x-circle" };
    default:
      return { color: colors.primary, icon: "bell" };
  }
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { apiKey, alunoToken } = useAuth();
  const { openUrl } = useInAppBrowser();
  const { permissionGranted, requestPermission } = useNotifications();

  const [notifs, setNotifs] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [permStatus, setPermStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [togglingPerm, setTogglingPerm] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Check permission status on mount and when returning to foreground
  useEffect(() => {
    if (isExpoGo || Platform.OS === "web") return;
    Notifications.getPermissionsAsync()
      .then(({ status }) => setPermStatus(status as any))
      .catch(() => {});
  }, [permissionGranted]);

  async function handleToggleNotifications(value: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!value) {
      // Cannot programmatically revoke — send to settings
      Linking.openSettings();
      return;
    }
    if (permStatus === "denied") {
      // Already denied — must go to settings to re-enable
      Linking.openSettings();
      return;
    }
    setTogglingPerm(true);
    try {
      const granted = await requestPermission();
      setPermStatus(granted ? "granted" : "denied");
    } finally {
      setTogglingPerm(false);
    }
  }

  async function fetchNotifs() {
    if (!apiKey || !alunoToken) { setLoading(false); setRefreshing(false); return; }
    try {
      const res = await averonApi.getNotificacoes(apiKey, alunoToken);
      setNotifs(res.data ?? []);
    } catch {
      setNotifs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchNotifs(); }, [apiKey, alunoToken]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifs();
  }, [apiKey, alunoToken]);

  async function handlePress(notif: Notificacao) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Track click (fire-and-forget, don't block UI)
    if (!tracked.has(notif.id) && apiKey && alunoToken) {
      setTracked((prev) => new Set(prev).add(notif.id));
      averonApi.trackNotificacao(apiKey, alunoToken, notif.id).catch(() => {});
    }

    // Navigate to URL if present
    if (notif.url) {
      openUrl(notif.url, notif.titulo);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Notificações</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(n) => n.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            Platform.OS !== "web" ? (
              <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.permIconWrap, {
                  backgroundColor: isExpoGo
                    ? colors.muted
                    : permStatus === "granted"
                    ? colors.primary + "18"
                    : colors.warning + "18",
                }]}>
                  <Feather
                    name={isExpoGo ? "smartphone" : permStatus === "granted" ? "bell" : "bell-off"}
                    size={20}
                    color={isExpoGo ? colors.mutedForeground : permStatus === "granted" ? colors.primary : colors.warning}
                  />
                </View>
                <View style={styles.permBody}>
                  <Text style={[styles.permTitle, { color: colors.foreground }]}>
                    {isExpoGo
                      ? "Notificações push"
                      : permStatus === "granted"
                      ? "Notificações ativas"
                      : permStatus === "denied"
                      ? "Notificações bloqueadas"
                      : "Ativar notificações"}
                  </Text>
                  <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
                    {isExpoGo
                      ? "Disponível apenas no app instalado (build de produção)"
                      : permStatus === "granted"
                      ? "Você receberá avisos sobre novidades e atividades"
                      : permStatus === "denied"
                      ? "Vá em Ajustes para liberar as notificações"
                      : "Ative para receber avisos sobre novidades e atividades"}
                  </Text>
                </View>
                {!isExpoGo && (
                  togglingPerm ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : permStatus === "denied" ? (
                    <TouchableOpacity
                      style={[styles.permSettingsBtn, { borderColor: colors.border }]}
                      onPress={() => Linking.openSettings()}
                    >
                      <Text style={[styles.permSettingsBtnText, { color: colors.foreground }]}>
                        Ajustes
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Switch
                      value={permStatus === "granted"}
                      onValueChange={handleToggleNotifications}
                      trackColor={{ true: colors.primary, false: colors.border }}
                      thumbColor="#fff"
                    />
                  )
                )}
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const conf = getTipoConfig(item.tipo, colors);
            const wasTracked = tracked.has(item.id);
            const isRead = item.lida || wasTracked;
            const isClickable = !!item.url;

            return (
              <TouchableOpacity
                style={[
                  styles.notifCard,
                  {
                    backgroundColor: isRead ? colors.card : colors.primary + "08",
                    borderColor: isRead ? colors.border : colors.primary + "30",
                  },
                ]}
                onPress={() => handlePress(item)}
                activeOpacity={isClickable ? 0.7 : 1}
              >
                {/* Unread dot */}
                {!isRead && (
                  <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                )}

                {/* Icon */}
                <View style={[styles.notifIcon, { backgroundColor: conf.color + "18" }]}>
                  <Feather name={conf.icon as any} size={20} color={conf.color} />
                </View>

                {/* Body */}
                <View style={styles.notifBody}>
                  <View style={styles.notifTopRow}>
                    <Text
                      style={[
                        styles.notifTitulo,
                        { color: colors.foreground, fontFamily: isRead ? "Inter_500Medium" : "Inter_700Bold" },
                      ]}
                      numberOfLines={1}
                    >
                      {item.titulo}
                    </Text>
                    <Text style={[styles.notifTempo, { color: colors.mutedForeground }]}>
                      {timeAgo(item.created_at)}
                    </Text>
                  </View>
                  <Text style={[styles.notifMsg, { color: colors.mutedForeground }]} numberOfLines={3}>
                    {item.mensagem}
                  </Text>
                  {isClickable && (
                    <View style={styles.notifLink}>
                      <Feather name="external-link" size={11} color={colors.primary} />
                      <Text style={[styles.notifLinkText, { color: colors.primary }]}>Ver mais</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="bell-off" size={44} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Tudo em dia!</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Nenhuma notificação por aqui ainda.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 10 },
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notifBody: { flex: 1, gap: 4 },
  notifTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 16,
  },
  notifTitulo: { flex: 1, fontSize: 14, lineHeight: 18 },
  notifTempo: { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 0 },
  notifMsg: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  notifLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  notifLinkText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  // Permission banner
  permCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
  },
  permIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  permBody: { flex: 1, gap: 2 },
  permTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  permDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  permSettingsBtn: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  permSettingsBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
