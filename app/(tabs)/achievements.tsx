import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  averonApi,
  Conquista,
  Nivel,
  RankingEntry,
  ScoreAluno,
} from "@/services/averon";

// ── Level palette (colors + emojis by position index) ─────────
const LEVEL_PALETTE = [
  { color: "#6B7280", emoji: "🌱" },
  { color: "#3B82F6", emoji: "📘" },
  { color: "#8B5CF6", emoji: "🎓" },
  { color: "#F59E0B", emoji: "⚡" },
  { color: "#EF4444", emoji: "🔥" },
  { color: "#10B981", emoji: "👑" },
];

function getLevelStyle(position: number, emoji?: string) {
  const palette = LEVEL_PALETTE[Math.min(position - 1, LEVEL_PALETTE.length - 1)];
  return { color: palette.color, emoji: emoji || palette.emoji };
}

function getNivelAtual(niveis: Nivel[], pontos: number): Nivel | null {
  if (niveis.length === 0) return null;
  const sorted = [...niveis].sort((a, b) => a.position - b.position);
  let current = sorted[0];
  for (const n of sorted) {
    if (pontos >= n.min_xp) current = n;
    else break;
  }
  return current;
}

function getProximoNivel(niveis: Nivel[], pontos: number): Nivel | null {
  if (niveis.length === 0) return null;
  const sorted = [...niveis].sort((a, b) => a.position - b.position);
  const atual = getNivelAtual(niveis, pontos);
  if (!atual) return sorted[0];
  const idx = sorted.findIndex((n) => n.position === atual.position);
  return sorted[idx + 1] ?? null;
}

function getLevelProgress(niveis: Nivel[], pontos: number): number {
  const proximo = getProximoNivel(niveis, pontos);
  if (!proximo) return 1;
  const atual = getNivelAtual(niveis, pontos);
  const base = atual?.min_xp ?? 0;
  const range = proximo.min_xp - base;
  if (range <= 0) return 1;
  return Math.min((pontos - base) / range, 1);
}

// ── Tabs ──────────────────────────────────────────────────────
type TabId = "conquistas" | "ranking";
const TABS: { id: TabId; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "conquistas", label: "Conquistas", icon: "award" },
  { id: "ranking", label: "Ranking", icon: "bar-chart-2" },
];

export default function AchievementsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { aluno, apiKey, alunoToken } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>("conquistas");
  const [score, setScore] = useState<ScoreAluno | null>(null);
  const [niveis, setNiveis] = useState<Nivel[]>([]);
  const [todasConquistas, setTodasConquistas] = useState<Conquista[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [scoreLoading, setScoreLoading] = useState(true);
  const [conquistasLoading, setConquistasLoading] = useState(true);
  const [rankingLoading, setRankingLoading] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 90 : insets.bottom + 90;

  function fetchAll(isRefresh = false) {
    if (!apiKey || !alunoToken || !aluno?.id) {
      setScoreLoading(false);
      setConquistasLoading(false);
      setRankingLoading(false);
      if (isRefresh) setRefreshing(false);
      return;
    }

    averonApi.getNiveis(apiKey)
      .then((res: any) => {
        const list = res?.data ?? (Array.isArray(res) ? res : []);
        if (list.length > 0) setNiveis(list);
      })
      .catch(() => {});

    averonApi.getScore(apiKey, aluno.id, alunoToken)
      .then((res) => setScore(res))
      .catch(() => {})
      .finally(() => setScoreLoading(false));

    averonApi.getConquistas(apiKey, aluno.id)
      .then((res: any) => {
        const list = res?.data ?? res?.conquistas ?? (Array.isArray(res) ? res : []);
        setTodasConquistas(list);
      })
      .catch(() => {})
      .finally(() => setConquistasLoading(false));

    averonApi.getRanking(apiKey, 20)
      .then((res: any) => {
        const list = res?.data ?? res?.ranking ?? (Array.isArray(res) ? res : []);
        setRanking(list);
      })
      .catch(() => {})
      .finally(() => {
        setRankingLoading(false);
        if (isRefresh) setRefreshing(false);
      });
  }

  useEffect(() => { fetchAll(); }, [apiKey, alunoToken, aluno?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!apiKey || !alunoToken || !aluno?.id) return;
      averonApi.getNiveis(apiKey)
        .then((res: any) => {
          const list = res?.data ?? (Array.isArray(res) ? res : []);
          if (list.length > 0) setNiveis(list);
        })
        .catch(() => {});
      averonApi.getScore(apiKey, aluno.id, alunoToken)
        .then((res) => setScore(res))
        .catch(() => {});
      averonApi.getConquistas(apiKey, aluno.id)
        .then((res: any) => {
          const list = res?.data ?? res?.conquistas ?? (Array.isArray(res) ? res : []);
          setTodasConquistas(list);
        })
        .catch(() => {});
    }, [apiKey, alunoToken, aluno?.id])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll(true);
  }, [apiKey, alunoToken, aluno?.id]);

  const pontos = score?.pontos ?? 0;
  const nivelAtual = getNivelAtual(niveis, pontos);
  const proximoNivel = getProximoNivel(niveis, pontos);
  const levelProgress = getLevelProgress(niveis, pontos);
  const levelStyle = getLevelStyle(nivelAtual?.position ?? 1, nivelAtual?.emoji);

  const conquistasDesbloqueadas = todasConquistas.filter((c) => c.desbloqueada);
  const minhaPos = ranking.find((r) => r.aluno_id === aluno?.id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* ── Header gradient ── */}
        <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.primary }]}>
          <Text style={styles.headerTitle}>Meu Progresso</Text>
          <Text style={styles.headerSub}>Conquistas e ranking de aprendizado</Text>
        </View>

        {/* ── Score card ── */}
        <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {scoreLoading ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : (
            <>
              <View style={styles.scoreTop}>
                <View style={[styles.levelBadge, { backgroundColor: levelStyle.color + "18", borderColor: levelStyle.color + "35" }]}>
                  <Text style={styles.levelEmoji}>{levelStyle.emoji}</Text>
                  <View>
                    <Text style={[styles.levelLabel, { color: colors.mutedForeground }]}>Nível</Text>
                    <Text style={[styles.levelText, { color: levelStyle.color }]}>
                      {nivelAtual?.nome ?? "—"}
                    </Text>
                  </View>
                </View>
                <View style={styles.scoreRight}>
                  <Text style={[styles.pointsNum, { color: colors.foreground }]}>
                    {pontos.toLocaleString("pt-BR")}
                  </Text>
                  <Text style={[styles.pointsLabel, { color: colors.mutedForeground }]}>XP total</Text>
                </View>
              </View>

              {proximoNivel && (
                <View style={{ marginTop: 14 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
                      Próximo nível: {getLevelStyle(proximoNivel.position, proximoNivel.emoji).emoji} {proximoNivel.nome}
                    </Text>
                    <Text style={[styles.progressLabel, { color: levelStyle.color, fontFamily: "Inter_600SemiBold" }]}>
                      {Math.round(levelProgress * 100)}%
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { backgroundColor: levelStyle.color, width: `${Math.round(levelProgress * 100)}%` as any },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressSub, { color: colors.mutedForeground }]}>
                    {pontos} / {proximoNivel.min_xp} XP
                  </Text>
                </View>
              )}

              {!proximoNivel && nivelAtual && (
                <View style={{ marginTop: 14, alignItems: "center" }}>
                  <Text style={[styles.masterText, { color: levelStyle.color }]}>
                    👑 Nível máximo atingido!
                  </Text>
                </View>
              )}

              <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
                <StatItem
                  value={`${conquistasDesbloqueadas.length}`}
                  label="Conquistas"
                  colors={colors}
                />
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <StatItem
                  value={minhaPos ? `#${minhaPos.posicao}` : "—"}
                  label="Ranking"
                  colors={colors}
                  highlight={!!minhaPos}
                  highlightColor={levelStyle.color}
                />
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <StatItem
                  value={`${todasConquistas.length > 0 ? Math.round((conquistasDesbloqueadas.length / todasConquistas.length) * 100) : 0}%`}
                  label="Completado"
                  colors={colors}
                />
              </View>
            </>
          )}
        </View>

        {/* ── Tabs ── */}
        <View style={[styles.tabsRow, { borderBottomColor: colors.border }]}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabBtn,
                activeTab === tab.id && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab.id);
              }}
            >
              <Feather
                name={tab.icon}
                size={15}
                color={activeTab === tab.id ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === tab.id ? colors.primary : colors.mutedForeground },
                  activeTab === tab.id && { fontFamily: "Inter_700Bold" },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab content ── */}
        {activeTab === "conquistas" ? (
          conquistasLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                Carregando conquistas...
              </Text>
            </View>
          ) : (
            <ConquistasTab conquistas={todasConquistas} colors={colors} />
          )
        ) : rankingLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Carregando ranking...
            </Text>
          </View>
        ) : (
          <RankingTab
            ranking={ranking}
            meuId={aluno?.id ?? ""}
            colors={colors}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ── StatItem ──────────────────────────────────────────────────
function StatItem({
  value,
  label,
  colors,
  highlight,
  highlightColor,
}: {
  value: string;
  label: string;
  colors: any;
  highlight?: boolean;
  highlightColor?: string;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statNum, { color: highlight && highlightColor ? highlightColor : colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ── ConquistasTab ─────────────────────────────────────────────
function ConquistasTab({
  conquistas,
  colors,
}: {
  conquistas: Conquista[];
  colors: any;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.floor((screenWidth - 24 - 12) / 2);

  const unlocked = conquistas.filter((c) => c.desbloqueada);
  const locked = conquistas.filter((c) => !c.desbloqueada);

  if (conquistas.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🏆</Text>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          Nenhuma conquista cadastrada
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          As conquistas aparecerão aqui quando o administrador configurá-las.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ paddingBottom: 8 }}>
      {unlocked.length > 0 && (
        <View>
          <SectionHeader icon="unlock" label={`Desbloqueadas (${unlocked.length})`} color="#10B981" colors={colors} />
          <View style={styles.grid}>
            {unlocked.map((c) => (
              <ConquistaCard key={c.id} conquista={c} unlocked unlockedAt={c.desbloqueada_em ?? undefined} colors={colors} cardWidth={cardWidth} />
            ))}
          </View>
        </View>
      )}
      {locked.length > 0 && (
        <View>
          <SectionHeader icon="lock" label={`Pendentes (${locked.length})`} color={colors.mutedForeground} colors={colors} />
          <View style={styles.grid}>
            {locked.map((c) => (
              <ConquistaCard key={c.id} conquista={c} unlocked={false} colors={colors} cardWidth={cardWidth} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function SectionHeader({
  icon,
  label,
  color,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  colors: any;
}) {
  return (
    <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
      <Feather name={icon} size={14} color={color} />
      <Text style={[styles.sectionTitle, { color }]}>{label}</Text>
    </View>
  );
}

function gerarDescricao(conquista: Conquista): string {
  const n = conquista.criterio_valor ?? 1;
  const xp = conquista.pontos;
  const evento = conquista.evento_esperado;
  const tipo = conquista.criterio_tipo;

  if (tipo === "score_total") {
    return `Ao acumular ${n} XP no total, você ganha ${xp} XP.`;
  }
  if (tipo === "minutos_total") {
    return n === 1
      ? `Ao estudar 1 minuto, você ganha ${xp} XP.`
      : `Ao estudar ${n} minutos, você ganha ${xp} XP.`;
  }
  if (tipo === "downloads_total") {
    return n === 1
      ? `Ao baixar 1 arquivo, você ganha ${xp} XP.`
      : `Ao baixar ${n} arquivos, você ganha ${xp} XP.`;
  }
  if (tipo === "manual") {
    return "Conquista desbloqueada manualmente pelo administrador.";
  }

  switch (evento) {
    case "watch_lesson":
      return n === 1
        ? `Ao assistir uma aula, você ganha ${xp} XP.`
        : `Ao assistir ${n} aulas, você ganha ${xp} XP.`;
    case "complete_course":
      return n === 1
        ? `Ao concluir um curso, você ganha ${xp} XP.`
        : `Ao concluir ${n} cursos, você ganha ${xp} XP.`;
    case "community_post":
      return n === 1
        ? `Ao fazer uma postagem na comunidade, você ganha ${xp} XP.`
        : `Ao fazer ${n} postagens na comunidade, você ganha ${xp} XP.`;
    case "community_comment":
      return n === 1
        ? `Ao comentar em um post, você ganha ${xp} XP.`
        : `Ao comentar em ${n} posts, você ganha ${xp} XP.`;
    case "community_like":
      return n === 1
        ? `Ao curtir um post, você ganha ${xp} XP.`
        : `Ao curtir ${n} posts, você ganha ${xp} XP.`;
    case "download_file":
      return n === 1
        ? `Ao baixar um arquivo, você ganha ${xp} XP.`
        : `Ao baixar ${n} arquivos, você ganha ${xp} XP.`;
    case "daily_login":
      return n === 1
        ? `Ao fazer login no app, você ganha ${xp} XP.`
        : `Ao fazer login por ${n} dias seguidos, você ganha ${xp} XP.`;
    case "app_review":
      return `Ao avaliar o app, você ganha ${xp} XP.`;
    default:
      return `Ao completar a ação, você ganha ${xp} XP.`;
  }
}

function ConquistaCard({
  conquista,
  unlocked,
  unlockedAt,
  colors,
  cardWidth,
}: {
  conquista: Conquista;
  unlocked: boolean;
  unlockedAt?: string;
  colors: any;
  cardWidth: number;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function onPress() {
    if (!unlocked) return;
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.07, useNativeDriver: true, speed: 30 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const dateStr = unlockedAt
    ? new Date(unlockedAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <TouchableOpacity activeOpacity={unlocked ? 0.85 : 1} onPress={onPress} style={{ width: cardWidth }}>
      <Animated.View
        style={[
          styles.conquistaCard,
          {
            backgroundColor: unlocked ? colors.card : colors.muted + "90",
            borderColor: unlocked ? "#10B981" + "50" : colors.border,
            borderWidth: unlocked ? 1.5 : StyleSheet.hairlineWidth,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Top: icon + XP */}
        <View style={styles.conquistaCardTop}>
          <View
            style={[
              styles.conquistaIconWrap,
              {
                backgroundColor: unlocked ? "#10B981" + "15" : colors.border + "50",
                borderColor: unlocked ? "#10B981" + "30" : colors.border,
              },
            ]}
          >
            {unlocked ? (
              <Feather
                name={(conquista.icone?.replace(/_/g, "-") as any) || "award"}
                size={22}
                color="#10B981"
              />
            ) : (
              <Feather name="lock" size={20} color={colors.mutedForeground} />
            )}
          </View>
          <View style={[styles.xpBadge, { backgroundColor: unlocked ? "#10B981" + "15" : colors.border }]}>
            <Feather name="zap" size={9} color={unlocked ? "#10B981" : colors.mutedForeground} />
            <Text style={[styles.xpBadgeText, { color: unlocked ? "#10B981" : colors.mutedForeground }]}>
              {conquista.pontos} XP
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text
          style={[
            styles.conquistaTitulo,
            { color: unlocked ? colors.foreground : colors.mutedForeground },
          ]}
          numberOfLines={2}
        >
          {conquista.titulo}
        </Text>

        {/* Description */}
        <Text
          style={[styles.conquistaDesc, { color: colors.mutedForeground }]}
          numberOfLines={3}
        >
          {gerarDescricao(conquista)}
        </Text>

        {/* Footer */}
        <View style={[styles.conquistaFooter, { borderTopColor: colors.border }]}>
          {unlocked ? (
            <>
              <Feather name="check-circle" size={11} color="#10B981" />
              <Text style={[styles.conquistaFooterText, { color: "#10B981" }]}>
                {dateStr ?? "Desbloqueada"}
              </Text>
            </>
          ) : (
            <>
              <Feather name="target" size={11} color={colors.mutedForeground} />
              <Text style={[styles.conquistaFooterText, { color: colors.mutedForeground }]}>
                {conquista.criterio_tipo === "score_total"
                  ? `${conquista.criterio_valor} XP`
                  : conquista.criterio_tipo === "minutos_total"
                  ? `${conquista.criterio_valor} min`
                  : conquista.criterio_tipo === "downloads_total"
                  ? `${conquista.criterio_valor} downloads`
                  : conquista.criterio_tipo === "manual"
                  ? "Liberação manual"
                  : conquista.evento_esperado
                  ? ({
                      watch_lesson: "Assistir aulas",
                      complete_course: "Concluir cursos",
                      community_post: "Postar na comunidade",
                      community_comment: "Comentar em posts",
                      community_like: "Curtir posts",
                      download_file: "Baixar arquivos",
                      daily_login: "Login diário",
                      app_review: "Avaliar o app",
                    } as Record<string, string>)[conquista.evento_esperado] ?? conquista.evento_esperado
                  : "Por evento"}
              </Text>
            </>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── RankingTab ────────────────────────────────────────────────
function RankingTab({
  ranking,
  meuId,
  colors,
}: {
  ranking: RankingEntry[];
  meuId: string;
  colors: any;
}) {
  if (ranking.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>📊</Text>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          Ranking ainda vazio
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          Complete aulas para aparecer no ranking.
        </Text>
      </View>
    );
  }

  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  const PODIUM_ORDER = top3.length >= 2
    ? ([top3[1], top3[0], top3[2]].filter(Boolean) as typeof top3)
    : top3;
  const PODIUM_HEIGHTS = [80, 100, 64];
  const PODIUM_MEDALS = ["🥈", "🥇", "🥉"];
  const PODIUM_COLORS = ["#9CA3AF", "#F59E0B", "#CD7C2F"];

  return (
    <View>
      {/* ── Podium (top 3) ── */}
      {top3.length >= 2 && (
        <View style={[styles.podiumWrap, { backgroundColor: colors.primary + "08" }]}>
          <Text style={[styles.podiumTitle, { color: colors.mutedForeground }]}>
            🏆 Top {top3.length}
          </Text>
          <View style={styles.podiumRow}>
            {PODIUM_ORDER.map((entry, i) => {
              if (!entry) return null;
              const isMe = entry.aluno_id === meuId;
              const realPos = i === 0 ? 1 : i === 1 ? 0 : 2;
              const podiumHeight = PODIUM_HEIGHTS[i];
              const medal = PODIUM_MEDALS[i];
              const medalColor = PODIUM_COLORS[i];
              const initials = (entry.nome ?? "?")[0].toUpperCase();

              return (
                <View key={entry.aluno_id} style={[styles.podiumItem, i === 1 && styles.podiumCenter]}>
                  {/* Avatar */}
                  <View style={[styles.podiumAvatarWrap, isMe && { borderColor: colors.primary, borderWidth: 2 }]}>
                    {entry.avatar_url ? (
                      <Image
                        source={{ uri: entry.avatar_url }}
                        style={styles.podiumAvatar}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.podiumAvatarFallback, { backgroundColor: medalColor + "30" }]}>
                        <Text style={[styles.podiumAvatarText, { color: medalColor }]}>{initials}</Text>
                      </View>
                    )}
                    <Text style={styles.podiumMedal}>{medal}</Text>
                  </View>

                  {/* Name */}
                  <Text
                    style={[styles.podiumName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {entry.nome?.split(" ")[0] ?? "Aluno"}
                    {isMe ? " ✦" : ""}
                  </Text>

                  {/* Points */}
                  <Text style={[styles.podiumPoints, { color: medalColor }]}>
                    {entry.pontos.toLocaleString("pt-BR")} XP
                  </Text>

                  {/* Pedestal */}
                  <View
                    style={[
                      styles.pedestal,
                      { height: podiumHeight, backgroundColor: medalColor + "25", borderColor: medalColor + "40" },
                    ]}
                  >
                    <Text style={[styles.pedestalPos, { color: medalColor }]}>
                      {PODIUM_MEDALS[i]}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Rest of ranking ── */}
      {(top3.length < 2 ? ranking : rest).map((entry, idx) => {
        const pos = top3.length >= 2 ? idx + 4 : idx + 1;
        const isMe = entry.aluno_id === meuId;
        const initials = (entry.nome ?? "?")[0].toUpperCase();

        return (
          <View
            key={entry.aluno_id}
            style={[
              styles.rankRow,
              {
                backgroundColor: isMe ? colors.primary + "10" : colors.card,
                borderColor: isMe ? colors.primary + "40" : colors.border,
              },
            ]}
          >
            <View style={styles.rankPosWrap}>
              <Text style={[styles.rankPos, { color: colors.mutedForeground }]}>{pos}</Text>
            </View>

            <View style={styles.rankAvatarWrap}>
              {entry.avatar_url ? (
                <Image source={{ uri: entry.avatar_url }} style={styles.rankAvatar} resizeMode="cover" />
              ) : (
                <View style={[styles.rankAvatarFallback, { backgroundColor: isMe ? colors.primary + "25" : colors.muted }]}>
                  <Text style={[styles.rankInitial, { color: isMe ? colors.primary : colors.mutedForeground }]}>
                    {initials}
                  </Text>
                </View>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.rankNome, { color: colors.foreground }]} numberOfLines={1}>
                {entry.nome ?? "Aluno"}
                {isMe ? (
                  <Text style={[styles.rankMeLabel, { color: colors.primary }]}> (você)</Text>
                ) : null}
              </Text>
              <Text style={[styles.rankEmail, { color: colors.mutedForeground }]} numberOfLines={1}>
                {entry.email}
              </Text>
            </View>

            <View style={styles.rankPoints}>
              <Feather name="zap" size={12} color={colors.primary} />
              <Text style={[styles.rankPointsText, { color: colors.primary }]}>
                {entry.pontos.toLocaleString("pt-BR")}
              </Text>
            </View>
          </View>
        );
      })}

      {/* My position highlight if not in top 20 */}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerTitle: { color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },

  scoreCard: {
    margin: 16,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
  },
  scoreTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  levelBadge: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1,
  },
  levelEmoji: { fontSize: 22 },
  levelLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  levelText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  scoreRight: { alignItems: "flex-end" },
  pointsNum: { fontSize: 34, fontFamily: "Inter_700Bold", lineHeight: 38 },
  pointsLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  progressLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  progressSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  masterText: { fontSize: 14, fontFamily: "Inter_700Bold" },

  statsRow: {
    flexDirection: "row",
    marginTop: 16, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statNum: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  statDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 8 },

  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12,
  },
  tabLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },

  center: { padding: 40, alignItems: "center", gap: 10 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, marginTop: 4 },

  // Section headers
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginTop: 20, marginBottom: 12,
    paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },

  // Conquistas grid
  grid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 12, gap: 12,
  },
  conquistaCard: {
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  conquistaCardTop: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4,
  },
  conquistaIconWrap: {
    width: 48, height: 48, borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  xpBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8,
  },
  xpBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  conquistaTitulo: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  conquistaDesc: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  conquistaFooter: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingTop: 8, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth,
  },
  conquistaFooterText: { fontSize: 10, fontFamily: "Inter_400Regular", flex: 1 },

  // Podium
  podiumWrap: {
    margin: 16, borderRadius: 20, padding: 16, paddingBottom: 0,
  },
  podiumTitle: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16,
  },
  podiumRow: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 8,
  },
  podiumItem: {
    flex: 1, alignItems: "center", gap: 4,
  },
  podiumCenter: { marginBottom: 0 },
  podiumAvatarWrap: {
    borderRadius: 30, overflow: "visible",
    position: "relative",
  },
  podiumAvatar: { width: 54, height: 54, borderRadius: 27 },
  podiumAvatarFallback: {
    width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center",
  },
  podiumAvatarText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  podiumMedal: { fontSize: 18, textAlign: "center", marginTop: 2 },
  podiumName: { fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  podiumPoints: { fontSize: 11, fontFamily: "Inter_700Bold", textAlign: "center" },
  pedestal: {
    width: "100%", borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
    marginTop: 8,
  },
  pedestalPos: { fontSize: 22 },

  // Ranking list
  rankRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginVertical: 4,
    padding: 12, borderRadius: 14, borderWidth: 1,
  },
  rankPosWrap: { width: 28, alignItems: "center" },
  rankPos: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  rankAvatarWrap: {},
  rankAvatar: { width: 38, height: 38, borderRadius: 19 },
  rankAvatarFallback: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  rankInitial: { fontSize: 14, fontFamily: "Inter_700Bold" },
  rankNome: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rankMeLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  rankEmail: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  rankPoints: { flexDirection: "row", alignItems: "center", gap: 3 },
  rankPointsText: { fontSize: 13, fontFamily: "Inter_700Bold" },
});
