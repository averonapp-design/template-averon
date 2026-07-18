import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useInAppBrowser } from "@/context/InAppBrowserContext";
import { useTheme, Banner } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { averonApi, AcessoCurso, CategoriaListar, Notificacao, Ticket } from "@/services/averon";
import { apiCache } from "@/services/apiCache";

const NOTIF_SEEN_KEY = "@averon_notif_seen";
const TICKET_REPLY_SEEN_KEY = "@averon_ticket_reply_seen";

function relTimeNotif(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

const { width: SCREEN_W } = Dimensions.get("window");
const HERO_W = SCREEN_W - 32;
const MODULE_W = 130;
const MODULE_H = 175;


export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { aluno, apiKey, alunoToken, refreshAluno } = useAuth();
  const { openUrl } = useInAppBrowser();
  const { brandName, logoUrl, banners, tema } = useTheme();
  const bannerRef = useRef<FlatList<Banner>>(null);
  const bannerIndexRef = useRef(0);
  const catListRefs = useRef<Record<string, FlatList | null>>({});
  const [catScrollX, setCatScrollX] = useState<Record<string, number>>({});
  const [catContentW, setCatContentW] = useState<Record<string, number>>({});
  const [catListW, setCatListW] = useState<Record<string, number>>({});

  const [acessos, setAcessos] = useState<AcessoCurso[]>([]);
  const [categorias, setCategorias] = useState<CategoriaListar[]>([]);
  const [acessoById, setAcessoById] = useState<Record<string, AcessoCurso>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  const [notifications, setNotifications] = useState<Notificacao[]>([]);
  const [ticketReplies, setTicketReplies] = useState<Ticket[]>([]);
  const [seenReplyIds, setSeenReplyIds] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<number>(0);
  const notifPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifSlide = useRef(new Animated.Value(600)).current;
  const notifOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showNotifications) {
      Animated.parallel([
        Animated.timing(notifSlide, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(notifOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(notifSlide, { toValue: 600, duration: 260, useNativeDriver: true }),
        Animated.timing(notifOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [showNotifications]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 90 : insets.bottom + 90;

  async function fetchNotifications() {
    if (!apiKey || !alunoToken) return;
    try {
      const [notifRes, ticketsRes] = await Promise.allSettled([
        averonApi.getNotificacoes(apiKey, alunoToken),
        averonApi.getTickets(apiKey, alunoToken),
      ]);
      if (notifRes.status === "fulfilled" && notifRes.value.ok && notifRes.value.enabled) {
        setNotifications(notifRes.value.notifications ?? []);
      }
      if (ticketsRes.status === "fulfilled") {
        const all = ticketsRes.value.data ?? ticketsRes.value.tickets ?? [];
        setTicketReplies(all.filter((t) => t.has_support_reply));
      }
    } catch {}
  }

  async function markSeen() {
    const now = Date.now();
    setLastSeenAt(now);
    const newSeenIds = ticketReplies.map((t) => t.id);
    setSeenReplyIds(newSeenIds);
    try {
      await AsyncStorage.setItem(NOTIF_SEEN_KEY, String(now));
      await AsyncStorage.setItem(TICKET_REPLY_SEEN_KEY, JSON.stringify(newSeenIds));
    } catch {}
  }

  type HomeCache = { categorias: CategoriaListar[]; acessos: AcessoCurso[]; acessoById: Record<string, AcessoCurso> };

  async function fetchData() {
    if (!apiKey) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const isGuest = !alunoToken || !aluno?.id;

    // Show cached data instantly on first load — no spinner if cache exists
    const cacheKey = isGuest ? "home_guest" : `home_${aluno!.id}`;
    try {
      const cached = await apiCache.get<HomeCache>(cacheKey);
      if (cached?.categorias?.length) {
        setCategorias(cached.categorias);
        setAcessos(cached.acessos);
        setAcessoById(cached.acessoById);
        setLoading(false);
      }
    } catch {}

    try {
      // Acessos (cursos do usuário) só existem quando logado
      const acessosPromise = isGuest
        ? Promise.resolve({ ok: true, aluno_id: "", total: 0, liberados: 0, cursos: [] as AcessoCurso[] })
        : averonApi.getAcessos(apiKey, aluno!.id, alunoToken!).catch(() => ({
            ok: true, aluno_id: "", total: 0, liberados: 0, cursos: [] as AcessoCurso[],
          }));

      // Try new /produtos/listar endpoint; fall back to /cursos on failure
      let cats: CategoriaListar[] = [];
      try {
        const listRes = await averonApi.getProdutosListar(apiKey, alunoToken ?? undefined);
        const rawCats = (listRes.categorias ?? [])
          .slice()
          .sort((a, b) => a.ordem - b.ordem || (a as any).created_at?.localeCompare?.((b as any).created_at) || 0);
        const rawProdutos = (listRes as any).produtos ?? [];

        if (rawProdutos.length > 0) {
          // API returns products flat — group by categoria_id
          const firstCatId = rawCats[0]?.id ?? "default";
          const prodsByCategoria: Record<string, typeof rawProdutos> = {};
          for (const p of rawProdutos) {
            const catKey = p.categoria_id ?? firstCatId;
            if (!prodsByCategoria[catKey]) prodsByCategoria[catKey] = [];
            prodsByCategoria[catKey].push(p);
          }
          cats = rawCats.map((c: any) => ({
            ...c,
            produtos: (prodsByCategoria[c.id] ?? []).sort(
              (a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0) || (b.created_at ?? "").localeCompare(a.created_at ?? "")
            ),
          }));
        } else if (rawCats.length > 0 && (rawCats[0] as any).produtos !== undefined) {
          // API already nests products inside categories
          cats = rawCats.map((c: any) => ({
            ...c,
            produtos: (c.produtos ?? []).sort(
              (a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0)
            ),
          }));
        } else {
          // Categories present but no products yet (migration pending)
          cats = rawCats.map((c: any) => ({ ...c, produtos: [] }));
        }

        // Remove empty categories (nothing to show)
        cats = cats.filter((c) => c.produtos.length > 0);

        // If all categories are empty, fall through to /cursos fallback
        if (cats.length === 0) throw new Error("empty");
      } catch {
        // /produtos/listar not available yet — build one default category from /cursos
        const cursosRes = await averonApi.getCursos(apiKey).catch(() => ({ data: [] as any[], total: 0 }));
        const cursos = (cursosRes.data ?? []).sort(
          (a: any, b: any) => (a.ordem ?? 9999) - (b.ordem ?? 9999)
        );
        cats = [{
          id: "default",
          nome: "",
          ordem: 0,
          produtos: cursos.map((c: any, idx: number) => ({
            id: c.id,
            titulo: c.titulo,
            ordem: c.ordem ?? idx,
            capa_url: c.capa_url ?? null,
            publicado: c.publicado ?? true,
          })),
        }];
      }
      setCategorias(cats);

      const acessosRes = await acessosPromise;
      const byId: Record<string, AcessoCurso> = {};
      for (const a of (acessosRes.cursos ?? [])) {
        byId[a.curso_id] = a;
      }

      // Modo guest: sem login = todos os produtos liberados
      if (isGuest) {
        for (const cat of cats) {
          for (const p of (cat.produtos ?? [])) {
            if (!byId[p.id]) {
              byId[p.id] = {
                curso_id: p.id,
                titulo: p.titulo,
                descricao: "",
                capa_url: p.capa_url ?? null,
                publicado: p.publicado ?? true,
                liberado: true,
                origem: null,
                liberado_em: null,
                link_sem_acesso: null,
                ordem: p.ordem ?? 0,
              };
            }
          }
        }
      }

      setAcessoById(byId);

      // Flatten all products (in category order) → hero carousel
      const allProducts = cats.flatMap((c) => c.produtos ?? []).filter(Boolean);
      const lista: AcessoCurso[] = allProducts.map((p) => {
        const acesso = byId[p.id];
        if (acesso) return acesso;
        return {
          curso_id: p.id,
          titulo: p.titulo,
          descricao: "",
          capa_url: p.capa_url,
          publicado: p.publicado,
          liberado: isGuest, // guest = sem login = acesso livre
          origem: null,
          liberado_em: null,
          link_sem_acesso: null,
          ordem: p.ordem,
        };
      });
      setAcessos(lista);

      // Persist fresh data so next open is instant
      apiCache.set(cacheKey, { categorias: cats, acessos: lista, acessoById: byId }).catch(() => {});
    } catch (err) {
      console.error("[HomeScreen] fetchData failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchData(); }, [apiKey, alunoToken, aluno?.id]);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_SEEN_KEY).then((v) => { if (v) setLastSeenAt(Number(v)); }).catch(() => {});
    AsyncStorage.getItem(TICKET_REPLY_SEEN_KEY).then((v) => { if (v) setSeenReplyIds(JSON.parse(v)); }).catch(() => {});
    fetchNotifications();
    notifPollRef.current = setInterval(fetchNotifications, 60000);
    return () => { if (notifPollRef.current) clearInterval(notifPollRef.current); };
  }, [apiKey, alunoToken]);

  // Banner auto-advance every 4s
  useEffect(() => {
    if (banners.length <= 1) return;
    const id = setInterval(() => {
      const next = (bannerIndexRef.current + 1) % banners.length;
      bannerRef.current?.scrollToIndex({ index: next, animated: true });
      bannerIndexRef.current = next;
    }, 4000);
    return () => clearInterval(id);
  }, [banners.length]);

  const unreadNotifCount = notifications.filter(
    (n) => new Date(n.created_at).getTime() > lastSeenAt
  ).length;
  const unreadReplyCount = ticketReplies.filter((t) => !seenReplyIds.includes(t.id)).length;
  const unreadCount = unreadNotifCount + unreadReplyCount;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAluno();
    await Promise.all([fetchData(), fetchNotifications()]);
  }, [apiKey, alunoToken, aluno?.id]);

  const firstName = aluno?.nome?.split(" ")[0] ?? "Aluno";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.brandLabel, { color: colors.mutedForeground }]}>
            {brandName ?? "Área de Membros"}
          </Text>
          <Text style={[styles.greeting, { color: colors.foreground }]}>
            Olá, {firstName} 👋
          </Text>
        </View>

        {/* Bell */}
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowNotifications(true);
            markSeen();
          }}
        >
          <Feather name="bell" size={22} color={colors.foreground} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 9 ? "9+" : String(unreadCount)}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={tema?.perfil_ativo !== false ? () => router.push("/(tabs)/profile") : undefined}
          activeOpacity={tema?.perfil_ativo !== false ? 0.7 : 1}
        >
          {aluno?.avatar_url ? (
            <Image source={{ uri: aluno.avatar_url }} style={[styles.avatar, { borderColor: colors.primary }]} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarInitial}>{firstName[0]?.toUpperCase()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Loading ── */}
      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}

      {/* ── Empty ── */}
      {!loading && categorias.length === 0 && (
        <View style={[styles.emptyWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="book-open" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum curso disponível</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Quando houver cursos disponíveis, eles aparecerão aqui.
          </Text>
        </View>
      )}

      {/* ── Banner Carousel ── */}
      {banners.length > 0 && (
        <View style={styles.carouselSection}>
          <FlatList
            ref={bannerRef}
            data={banners}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            keyExtractor={(b) => b.id}
            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
              bannerIndexRef.current = Math.max(0, Math.min(idx, banners.length - 1));
              setActiveSlide(bannerIndexRef.current);
            }}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={item.link_url ? 0.85 : 1}
                onPress={() => {
                  if (item.link_url) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    openUrl(item.link_url);
                  }
                }}
                style={styles.bannerItem}
              >
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.bannerImage}
                  contentFit="cover"
                />
              </TouchableOpacity>
            )}
          />
          {banners.length > 1 && (
            <View style={styles.dotsRow}>
              {banners.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: i === activeSlide ? colors.primary : colors.border },
                    i === activeSlide && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {!loading && categorias.length > 0 && (
        <>

          {/* ── Uma fileira por categoria ── */}
          {categorias.map((cat) => {
            if ((cat.produtos ?? []).length === 0) return null;
            return (
              <View key={cat.id} style={styles.cursoRow}>
                {/* Row header — hidden when nome is empty (fallback mode) */}
                {cat.nome ? (
                  <View style={styles.rowHeader}>
                    <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {cat.nome}
                    </Text>
                  </View>
                ) : null}

                {/* Course cover cards */}
                <View style={{ position: "relative" }}>
                  <FlatList
                  ref={(r) => { catListRefs.current[cat.id] = r; }}
                  data={cat.produtos}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
                  keyExtractor={(p) => p.id}
                  onScroll={(e) => {
                    const x = e.nativeEvent.contentOffset.x;
                    setCatScrollX((prev) => ({ ...prev, [cat.id]: x }));
                  }}
                  onContentSizeChange={(w) => {
                    setCatContentW((prev) => ({ ...prev, [cat.id]: w }));
                  }}
                  onLayout={(e) => {
                    if (e?.nativeEvent?.layout) {
                      setCatListW((prev) => ({ ...prev, [cat.id]: e.nativeEvent.layout.width }));
                    }
                  }}
                  scrollEventThrottle={16}
                  renderItem={({ item: produto }) => {
                    const acesso = acessoById[produto.id];
                    const liberado = acesso?.liberado ?? false;
                    const link = acesso?.link_sem_acesso ?? null;

                    function handlePress() {
                      if (liberado) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push(`/course/${produto.id}`);
                      } else if (link) {
                        openUrl(link);
                      }
                    }

                    return (
                      <TouchableOpacity
                        activeOpacity={0.88}
                        style={[styles.moduleCard, { width: MODULE_W, height: MODULE_H }]}
                        onPress={handlePress}
                      >
                        {produto.capa_url ? (
                          <Image
                            source={{ uri: produto.capa_url }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary + "33" }]} />
                        )}

                        {/* Lock overlay */}
                        {!liberado && (
                          <View style={styles.lockOverlay}>
                            <View style={[styles.lockCircle, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
                              <Feather name="lock" size={18} color="#fff" />
                            </View>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />

                  {/* Left arrow */}
                  {(catScrollX[cat.id] ?? 0) > 5 && (
                    <TouchableOpacity
                      style={styles.carrowLeft}
                      activeOpacity={0.8}
                      onPress={() => {
                        const cur = catScrollX[cat.id] ?? 0;
                        catListRefs.current[cat.id]?.scrollToOffset({
                          offset: Math.max(0, cur - (MODULE_W + 10)),
                          animated: true,
                        });
                      }}
                    >
                      <View style={styles.carrowCircle}>
                        <Feather name="chevron-left" size={18} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Right arrow */}
                  {((catContentW[cat.id] ?? 0) - (catListW[cat.id] ?? 0) - (catScrollX[cat.id] ?? 0)) > 5 && (
                    <TouchableOpacity
                      style={styles.carrowRight}
                      activeOpacity={0.8}
                      onPress={() => {
                        const cur = catScrollX[cat.id] ?? 0;
                        catListRefs.current[cat.id]?.scrollToOffset({
                          offset: cur + (MODULE_W + 10),
                          animated: true,
                        });
                      }}
                    >
                      <View style={styles.carrowCircle}>
                        <Feather name="chevron-right" size={18} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>

    {/* ── Notifications Bottom Sheet ── */}
    <Animated.View
      style={[StyleSheet.absoluteFill, { zIndex: 99 }]}
      pointerEvents={showNotifications ? "box-none" : "none"}
    >
      {/* Dim backdrop — tap anywhere outside the panel to close */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setShowNotifications(false)}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.notifOverlay, { opacity: notifOpacity }]}
          pointerEvents="none"
        />
      </Pressable>

      {/* Sliding panel — rendered after backdrop so it sits on top */}
      <Animated.View
        style={[
          styles.notifPanel,
          { backgroundColor: colors.background },
          { transform: [{ translateY: notifSlide }] },
        ]}
      >
        <View style={[styles.notifHandle, { backgroundColor: colors.border }]} />
        <View style={styles.notifHeaderRow}>
          <Text style={[styles.notifTitle, { color: colors.foreground }]}>Notificações</Text>
          <TouchableOpacity onPress={() => setShowNotifications(false)}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

      {notifications.length === 0 && ticketReplies.length === 0 ? (
        <View style={styles.notifEmpty}>
          <Feather name="bell-off" size={36} color={colors.mutedForeground} />
          <Text style={[styles.notifEmptyText, { color: colors.mutedForeground }]}>
            Nenhuma notificação por enquanto
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 + 49 }}
        >
          {ticketReplies.map((t) => {
            const isNew = !seenReplyIds.includes(t.id);
            return (
              <TouchableOpacity
                key={`reply_${t.id}`}
                style={[
                  styles.notifItem,
                  { borderBottomColor: colors.border },
                  isNew ? { backgroundColor: "#10B98110" } : null,
                ]}
                activeOpacity={0.75}
                onPress={() => {
                  setShowNotifications(false);
                  router.push("/support" as any);
                }}
              >
                <View style={styles.notifItemLeft}>
                  <View style={[styles.notifDot, { backgroundColor: isNew ? "#10B981" : "transparent" }]} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.notifItemTitle, { color: colors.foreground }]}>
                    💬 Resposta no chamado
                  </Text>
                  <Text style={[styles.notifItemMsg, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {t.assunto}{t.last_message ? `: ${t.last_message}` : ""}
                  </Text>
                  <Text style={[styles.notifItemTime, { color: colors.mutedForeground }]}>
                    {relTimeNotif(t.last_message_at ?? t.created_at)}
                  </Text>
                </View>
                <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          })}
          {notifications.map((n, i) => {
            const isNew = new Date(n.created_at).getTime() > lastSeenAt;
            return (
              <View
                key={n.id ?? i}
                style={[
                  styles.notifItem,
                  { borderBottomColor: colors.border },
                  isNew ? { backgroundColor: colors.primary + "0A" } : null,
                ]}
              >
                <View style={styles.notifItemLeft}>
                  <View style={[styles.notifDot, { backgroundColor: isNew ? colors.primary : "transparent" }]} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  {n.titulo ? (
                    <Text style={[styles.notifItemTitle, { color: colors.foreground }]}>{n.titulo}</Text>
                  ) : null}
                  <Text style={[styles.notifItemMsg, { color: n.titulo ? colors.mutedForeground : colors.foreground }]}>
                    {n.mensagem}
                  </Text>
                  <Text style={[styles.notifItemTime, { color: colors.mutedForeground }]}>
                    {relTimeNotif(n.created_at)}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
      </Animated.View>{/* closes sliding panel */}
    </Animated.View>{/* closes outer wrapper */}
    </View>
  );
}

// ── Hero Card ────────────────────────────────────────────────

function HeroCard({ acesso, colors, onPress }: { acesso: AcessoCurso; colors: any; onPress: () => void }) {
  return (
    <View style={[styles.heroCard, { width: HERO_W }]}>
      {acesso.capa_url ? (
        <Image source={{ uri: acesso.capa_url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary + "44" }]} />
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.88)"]}
        style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
      />
      {!acesso.liberado && (
        <View style={[styles.heroBadge, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
          <Feather name="lock" size={11} color="#fbbf24" />
          <Text style={styles.heroBadgeText}>Bloqueado</Text>
        </View>
      )}
      <View style={styles.heroContent}>
        <TouchableOpacity
          style={[styles.heroCta, { backgroundColor: acesso.liberado ? colors.primary : "#d97706" }]}
          onPress={onPress}
          activeOpacity={0.85}
        >
          <Text style={styles.heroCtaText}>
            {acesso.liberado ? "Acessar" : "Aperte aqui para comprar"}
          </Text>
          <Feather name={acesso.liberado ? "play" : "shopping-cart"} size={13} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  brandLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  greeting: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },

  bellBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  bellBadge: {
    position: "absolute", top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },

  notifOverlay: { backgroundColor: "rgba(0,0,0,0.45)" },
  notifPanel: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20,
    maxHeight: "80%",
    zIndex: 100,
    flexDirection: "column",
  },
  notifHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 16 },
  notifHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  notifTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  notifEmpty: { alignItems: "center", paddingVertical: 40, gap: 12 },
  notifEmptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  notifItem: { flexDirection: "row", gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  notifItemLeft: { paddingTop: 5 },
  notifDot: { width: 8, height: 8, borderRadius: 4 },
  notifItemTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  notifItemMsg: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  notifItemTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Category row scroll arrows
  carrowLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 36,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  carrowRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 36,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  carrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Banner carousel
  bannerItem: {
    width: SCREEN_W,
    paddingHorizontal: 16,
  },
  bannerImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 16,
    backgroundColor: "#1e1e2e",
  },

  loadingWrap: { paddingTop: 80, alignItems: "center" },
  emptyWrap: {
    margin: 20, borderRadius: 20, borderWidth: 1,
    padding: 40, alignItems: "center", gap: 12,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },

  // Carousel
  carouselSection: { marginBottom: 4 },
  heroCard: {
    height: 260,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#1e1e2e",
  },
  heroBadge: {
    position: "absolute", top: 14, left: 14,
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  heroBadgeText: { color: "#fbbf24", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  heroContent: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 18, paddingBottom: 20, gap: 12,
  },
  heroTitulo: {
    color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold", lineHeight: 26,
  },
  heroCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 13, borderRadius: 14,
  },
  heroCtaText: {
    color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold",
    textTransform: "uppercase", letterSpacing: 0.5,
  },

  // Dots
  dotsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, marginTop: 12, marginBottom: 4,
  },
  dot: { height: 6, width: 6, borderRadius: 3 },
  dotActive: { width: 18, borderRadius: 3 },

  // Per-course rows
  cursoRow: { marginTop: 22 },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  rowTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    flex: 1,
    marginRight: 8,
  },
  rowVerTudo: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

  // Module card
  moduleCard: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#1e1e2e",
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  lockCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)",
  },
  moduleTitleText: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold",
    padding: 8, lineHeight: 15,
  },
  moduleCardTitle: {
    color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 8, paddingBottom: 8, lineHeight: 15,
  },
});
