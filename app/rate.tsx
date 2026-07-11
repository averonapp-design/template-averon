import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { averonApi, Avaliacao } from "@/services/averon";

function StarRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity
          key={n}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onChange(n);
          }}
          activeOpacity={0.7}
          style={styles.starBtn}
        >
          <Text style={[styles.star, { opacity: n <= value ? 1 : 0.2 }]}>⭐</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ratingLabel(n: number): string {
  switch (n) {
    case 1: return "Muito ruim";
    case 2: return "Ruim";
    case 3: return "Regular";
    case 4: return "Bom";
    case 5: return "Excelente!";
    default: return "Toque para avaliar";
  }
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 86400) return "Hoje";
  if (diff < 604800) return `${Math.floor(diff / 86400)}d atrás`;
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function RateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { apiKey, alunoToken } = useAuth();
  const { brandName } = useTheme();

  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loadingAvaliacoes, setLoadingAvaliacoes] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (!apiKey) { setLoadingAvaliacoes(false); return; }
    averonApi
      .getAvaliacoes(apiKey)
      .then((res) => setAvaliacoes(res.data ?? []))
      .catch(() => setAvaliacoes([]))
      .finally(() => setLoadingAvaliacoes(false));
  }, [apiKey]);

  // Aggregate stats
  const totalRatings = avaliacoes.length;
  const avgRating = totalRatings > 0
    ? avaliacoes.reduce((s, a) => s + a.rating, 0) / totalRatings
    : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({
    star: n,
    count: avaliacoes.filter((a) => a.rating === n).length,
  }));

  async function handleSubmit() {
    if (rating === 0) {
      Alert.alert("Atenção", "Selecione uma nota antes de enviar.");
      return;
    }
    if (!apiKey || !alunoToken) return;
    setSending(true);
    try {
      await averonApi.createAvaliacao(apiKey, alunoToken, rating, comentario.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch {
      Alert.alert("Erro", "Não foi possível enviar a avaliação. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Avaliar</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Form ── */}
        {sent ? (
          <View style={[styles.successCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={[styles.successTitle, { color: colors.foreground }]}>
              Obrigado pela avaliação!
            </Text>
            <Text style={[styles.successDesc, { color: colors.mutedForeground }]}>
              Seu feedback nos ajuda a melhorar cada vez mais.
            </Text>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.back()}
            >
              <Text style={styles.doneBtnText}>Concluir</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>
              O que você acha da {brandName ?? "plataforma"}?
            </Text>
            <Text style={[styles.formDesc, { color: colors.mutedForeground }]}>
              Sua opinião é muito importante para nós.
            </Text>

            <StarRow value={rating} onChange={setRating} />
            {rating > 0 && (
              <Text style={[styles.ratingLabel, { color: colors.primary }]}>
                {ratingLabel(rating)}
              </Text>
            )}

            <TextInput
              style={[
                styles.commentInput,
                { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
              ]}
              placeholder="Deixe um comentário (opcional)..."
              placeholderTextColor={colors.mutedForeground}
              value={comentario}
              onChangeText={setComentario}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
              {comentario.length}/500
            </Text>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: rating > 0 ? colors.primary : colors.muted },
              ]}
              onPress={handleSubmit}
              disabled={sending || rating === 0}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="send" size={16} color={rating > 0 ? "#fff" : colors.mutedForeground} />
                  <Text style={[styles.submitText, { color: rating > 0 ? "#fff" : colors.mutedForeground }]}>
                    Enviar avaliação
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Resumo de avaliações ── */}
        {totalRatings > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Avaliações da comunidade
            </Text>
            <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Média */}
              <View style={styles.avgRow}>
                <Text style={[styles.avgNum, { color: colors.foreground }]}>
                  {avgRating.toFixed(1)}
                </Text>
                <View style={{ flex: 1, gap: 4 }}>
                  {dist.map(({ star, count }) => (
                    <View key={star} style={styles.barRow}>
                      <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>{star}</Text>
                      <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              backgroundColor: colors.primary,
                              width: totalRatings > 0 ? `${(count / totalRatings) * 100}%` as any : "0%",
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barCount, { color: colors.mutedForeground }]}>{count}</Text>
                    </View>
                  ))}
                  <Text style={[styles.totalText, { color: colors.mutedForeground }]}>
                    {totalRatings} {totalRatings === 1 ? "avaliação" : "avaliações"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Comentários recentes */}
            {avaliacoes.filter((a) => a.comentario).slice(0, 5).map((a) => (
              <View key={a.id} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewStars}>{"⭐".repeat(a.rating)}</Text>
                  <Text style={[styles.reviewTime, { color: colors.mutedForeground }]}>
                    {timeAgo(a.created_at)}
                  </Text>
                </View>
                <Text style={[styles.reviewComment, { color: colors.foreground }]}>
                  {a.comentario}
                </Text>
              </View>
            ))}
          </>
        )}

        {loadingAvaliacoes && (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  content: { padding: 16, gap: 14 },
  formCard: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 12, alignItems: "center" },
  formTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  formDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  starRow: { flexDirection: "row", gap: 8, marginVertical: 4 },
  starBtn: { padding: 4 },
  star: { fontSize: 40 },
  ratingLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  commentInput: {
    width: "100%", borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: "Inter_400Regular",
    minHeight: 100,
  },
  charCount: { alignSelf: "flex-end", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: -6 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 14, paddingVertical: 14, width: "100%",
  },
  submitText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  successCard: {
    borderRadius: 20, borderWidth: 1, padding: 32,
    alignItems: "center", gap: 12,
  },
  successEmoji: { fontSize: 52 },
  successTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  successDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  doneBtn: { marginTop: 8, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14 },
  doneBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", paddingHorizontal: 4 },
  statsCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  avgRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avgNum: { fontSize: 52, fontFamily: "Inter_700Bold", lineHeight: 60 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLabel: { fontSize: 12, fontFamily: "Inter_500Medium", width: 10, textAlign: "right" },
  barTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  barCount: { fontSize: 11, fontFamily: "Inter_400Regular", width: 18, textAlign: "right" },
  totalText: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  reviewCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewStars: { fontSize: 13, letterSpacing: 1 },
  reviewTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  reviewComment: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
