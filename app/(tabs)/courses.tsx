import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useInAppBrowser } from "@/context/InAppBrowserContext";
import { useColors } from "@/hooks/useColors";
import { averonApi, AcessoCurso, Curso } from "@/services/averon";

export default function CoursesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { apiKey, alunoToken, aluno } = useAuth();
  const { openUrl } = useInAppBrowser();
  const [cursos, setCursos] = useState<AcessoCurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 90 : insets.bottom + 90;

  async function fetchCursos() {
    if (!apiKey || !alunoToken || !aluno?.id) {
      setError("Configure a API Key para ver os cursos.");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setError("");
      // Fetch acessos and the full course list in parallel.
      // GET /cursos already returns items sorted by ordem, so we use it
      // to reorder the acessos list to match the admin-configured order.
      const [acessosRes, cursosRes] = await Promise.all([
        averonApi.getAcessos(apiKey, aluno.id, alunoToken),
        averonApi.getCursos(apiKey).catch(() => ({ data: [] as Curso[], total: 0 })),
      ]);
      const lista = acessosRes.cursos ?? [];
      const ordemMap: Record<string, number> = {};
      for (const c of (cursosRes.data ?? [])) ordemMap[c.id] = c.ordem ?? 9999;
      const ordenados = [...lista].sort(
        (a, b) => (ordemMap[a.curso_id] ?? 9999) - (ordemMap[b.curso_id] ?? 9999)
      );
      setCursos(ordenados);
    } catch (e: any) {
      const msg = e?.message ?? "Erro desconhecido";
      setError(`Não foi possível carregar os cursos.\n\n${msg}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchCursos(); }, [apiKey, alunoToken, aluno?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCursos();
  }, [apiKey, alunoToken, aluno?.id]);

  const filtered = search.trim()
    ? cursos.filter((c) => c.titulo.toLowerCase().includes(search.toLowerCase()))
    : cursos;

  const liberados = cursos.filter((c) => c.liberado).length;

  function handlePress(item: AcessoCurso) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!item.liberado && !item.gratis_cadastro) {
      if (item.link_sem_acesso) {
        openUrl(item.link_sem_acesso);
      }
      return;
    }
    router.push(`/course/${item.curso_id}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Produtos</Text>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {liberados} liberado{liberados !== 1 ? "s" : ""} · {cursos.length} total
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Buscar curso..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Carregando cursos...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => { setLoading(true); fetchCursos(); }}
          >
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.curso_id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="book-open" size={36} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {search ? "Nenhum resultado" : "Nenhum curso disponível"}
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                {search ? "Tente outro termo" : "Os cursos aparecerão aqui quando liberados"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: (item.liberado || item.gratis_cadastro) ? 1 : 0.8,
                },
              ]}
              onPress={() => handlePress(item)}
              activeOpacity={0.75}
            >
              {/* Capa */}
              <View style={styles.capaWrap}>
                {item.capa_url ? (
                  <Image source={{ uri: item.capa_url }} style={styles.capa} contentFit="cover" cachePolicy="memory-disk" />
                ) : (
                  <View style={[styles.capa, styles.capaPlaceholder, { backgroundColor: colors.primary + "15" }]}>
                    <Feather name="play-circle" size={36} color={colors.primary} />
                  </View>
                )}
                {/* Lock overlay */}
                {!item.liberado && !item.gratis_cadastro && (
                  <View style={styles.lockOverlay}>
                    <View style={styles.lockCircle}>
                      <Feather name="lock" size={22} color="#fff" />
                    </View>
                    {item.link_sem_acesso && (
                      <Text style={styles.lockHint}>Toque para obter acesso</Text>
                    )}
                  </View>
                )}
                {/* Free badge overlay */}
                {item.gratis_cadastro && !item.liberado && (
                  <View style={styles.freeBadgeOverlay}>
                    <View style={styles.freeBadge}>
                      <Feather name="gift" size={11} color="#10B981" />
                      <Text style={styles.freeBadgeText}>Grátis</Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {item.titulo}
                </Text>
                {item.descricao ? (
                  <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {item.descricao}
                  </Text>
                ) : null}
                <View style={styles.cardFooter}>
                  {item.liberado ? (
                    <View style={[styles.badge, { backgroundColor: colors.primary + "18" }]}>
                      <Feather name="check-circle" size={11} color={colors.primary} />
                      <Text style={[styles.badgeText, { color: colors.primary }]}>Liberado</Text>
                    </View>
                  ) : item.gratis_cadastro ? (
                    <View style={[styles.badge, { backgroundColor: "#10B98118" }]}>
                      <Feather name="gift" size={11} color="#10B981" />
                      <Text style={[styles.badgeText, { color: "#10B981" }]}>Grátis para cadastrados</Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, { backgroundColor: colors.muted }]}>
                      <Feather name="lock" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                        {item.link_sem_acesso ? "Adquirir acesso" : "Bloqueado"}
                      </Text>
                    </View>
                  )}
                  {(item.liberado || item.gratis_cadastro) && (
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  count: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  list: { paddingHorizontal: 16, gap: 14 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  capaWrap: { position: "relative" },
  capa: { width: "100%", height: 160 },
  capaPlaceholder: { alignItems: "center", justifyContent: "center" },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  lockCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  lockHint: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  freeBadgeOverlay: {
    position: "absolute",
    top: 10,
    left: 10,
  },
  freeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16,185,129,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  freeBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  cardBody: { padding: 14 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 6 },
  cardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 10 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12, paddingHorizontal: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
