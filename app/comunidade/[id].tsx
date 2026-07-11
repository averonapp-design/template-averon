import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { ImageGrid } from "@/components/ImageGrid";
import { useColors } from "@/hooks/useColors";
import { averonApi, ComunidadeComment, ComunidadePost } from "@/services/averon";

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function Avatar({ nome, url, size = 36, primary }: { nome: string; url?: string | null; size?: number; primary: string }) {
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: primary + "22", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: size * 0.4, fontFamily: "Inter_700Bold", color: primary }}>{(nome ?? "?")[0].toUpperCase()}</Text>
    </View>
  );
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { aluno, apiKey, alunoToken } = useAuth();

  const [post, setPost] = useState<ComunidadePost | null>(null);
  const [comments, setComments] = useState<ComunidadeComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [novoComment, setNovoComment] = useState("");
  const inputRef = useRef<TextInput>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function load() {
    if (!apiKey || !alunoToken || !id) return;
    try {
      const [postsRes, commentsRes]: [any, any] = await Promise.all([
        averonApi.getComunidadePosts(apiKey, alunoToken),
        averonApi.getComunidadeComments(apiKey, alunoToken, id),
      ]);
      // Normalize: API may return posts under data / posts / publicacoes / items
      const allPosts: ComunidadePost[] =
        postsRes?.data ?? postsRes?.posts ?? postsRes?.publicacoes ?? postsRes?.items ?? [];
      const found = allPosts.find((p) => p.id === id) ?? null;
      setPost(found);
      // API returns { ok, comments: [...] }
      const allComments: ComunidadeComment[] = commentsRes?.comments ?? [];
      setComments(Array.isArray(allComments) ? allComments : []);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id, apiKey, alunoToken]);

  async function handleLike() {
    if (!post || !apiKey || !alunoToken) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Capture state before optimistic update so rollback is reliable
    const wasLiked = post.liked_by_me;
    const prevCount = post.likes_count;

    // Optimistic update
    setPost((p) => p ? { ...p, liked_by_me: !wasLiked, likes_count: wasLiked ? prevCount - 1 : prevCount + 1 } : p);
    try {
      const res = await averonApi.likeComunidadePost(apiKey, alunoToken, post.id);
      // Only sync from server if it returned valid confirmed values
      if (res.ok && typeof res.liked === "boolean" && typeof res.likes_count === "number") {
        setPost((p) => p ? { ...p, liked_by_me: res.liked, likes_count: res.likes_count } : p);
      }
      // Otherwise keep the optimistic values
    } catch {
      // Revert to the state captured before the action
      setPost((p) => p ? { ...p, liked_by_me: wasLiked, likes_count: prevCount } : p);
    }
  }

  async function handleSend() {
    if (!novoComment.trim() || !apiKey || !alunoToken || !id) return;
    setSending(true);
    const texto = novoComment.trim();
    try {
      const res = await averonApi.createComunidadeComment(apiKey, alunoToken, id, texto);
      setNovoComment("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Fire XP events for community comment (fire-and-forget)
      if (aluno?.id) {
        averonApi.postEvento(apiKey, aluno.id, "community_comment").catch(() => {});
      }

      if (res.status === "approved") {
        const newComment = {
          id: res.id,
          texto,
          created_at: new Date().toISOString(),
          autor: { id: aluno?.id ?? "", nome: aluno?.nome ?? "", avatar_url: aluno?.avatar_url ?? null },
        };
        setComments((prev) => [...prev, newComment]);
        setPost((p) => p ? { ...p, comments_count: p.comments_count + 1 } : p);
      } else {
        Alert.alert(
          "Comentário enviado",
          "Seu comentário foi enviado para aprovação e aparecerá em breve.",
          [{ text: "OK" }]
        );
      }
    } catch {
      Alert.alert("Erro", "Não foi possível comentar. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background }]}>
        <View style={[styles.navbar, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.foreground }]}>Publicação</Text>
        </View>
        <View style={styles.center}>
          <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 8 }}>
            Publicação não encontrada
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Nav bar */}
      <View style={[styles.navbar, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Publicação</Text>
      </View>

      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Post body */}
            <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.postHeader}>
                <Avatar nome={post.autor.nome} url={post.autor.avatar_url} primary={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.autorNome, { color: colors.foreground }]}>{post.autor.nome}</Text>
                  <Text style={[styles.autorTime, { color: colors.mutedForeground }]}>{timeAgo(post.created_at)}</Text>
                </View>
              </View>

              {!!post.texto && (
                <Text style={[styles.postTexto, { color: colors.foreground }]}>{post.texto}</Text>
              )}

              {post.image_urls && post.image_urls.length > 0 && (
                <View style={{ marginBottom: 0, overflow: "hidden" }}>
                  <ImageGrid urls={post.image_urls} />
                </View>
              )}

              <View style={[styles.postActions, { borderTopColor: colors.border }]}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                  <Feather name="heart" size={18} color={post.liked_by_me ? "#EF4444" : colors.mutedForeground} />
                  <Text style={[styles.actionCount, { color: post.liked_by_me ? "#EF4444" : colors.mutedForeground }]}>
                    {post.likes_count}
                  </Text>
                </TouchableOpacity>
                <View style={styles.actionBtn}>
                  <Feather name="message-circle" size={18} color={colors.mutedForeground} />
                  <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{post.comments_count}</Text>
                </View>
              </View>
            </View>

            {comments.length > 0 && (
              <Text style={[styles.commentsHeading, { color: colors.mutedForeground }]}>
                {comments.length} {comments.length === 1 ? "comentário" : "comentários"}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyComments}>
            <Feather name="message-circle" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhum comentário ainda. Seja o primeiro!
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.commentRow, { borderBottomColor: colors.border }]}>
            <Avatar nome={item.autor.nome} url={item.autor.avatar_url} size={32} primary={colors.primary} />
            <View style={[styles.commentBubble, { backgroundColor: colors.muted }]}>
              <View style={styles.commentMeta}>
                <Text style={[styles.commentAutor, { color: colors.foreground }]}>{item.autor.nome}</Text>
                <Text style={[styles.commentTime, { color: colors.mutedForeground }]}>{timeAgo(item.created_at)}</Text>
              </View>
              <Text style={[styles.commentTexto, { color: colors.foreground }]}>{item.texto}</Text>
            </View>
          </View>
        )}
      />

      {/* Comment input */}
      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <Avatar nome={aluno?.nome ?? "?"} url={aluno?.avatar_url} size={32} primary={colors.primary} />
        <TextInput
          ref={inputRef}
          style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.muted }]}
          placeholder="Escreva um comentário..."
          placeholderTextColor={colors.mutedForeground}
          value={novoComment}
          onChangeText={setNovoComment}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendIconBtn, { backgroundColor: novoComment.trim() ? colors.primary : colors.muted }]}
          onPress={handleSend}
          disabled={!novoComment.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="send" size={16} color={novoComment.trim() ? "#fff" : colors.mutedForeground} />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  navbar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navTitle: { fontSize: 18, fontFamily: "Inter_700Bold", flex: 1 },
  postCard: { margin: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingBottom: 10 },
  autorNome: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  autorTime: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  postTexto: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22, paddingHorizontal: 14, paddingBottom: 12 },
  postActions: {
    flexDirection: "row", gap: 20, paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionCount: { fontSize: 14, fontFamily: "Inter_500Medium" },
  commentsHeading: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 20, paddingVertical: 10, textTransform: "uppercase", letterSpacing: 0.8,
  },
  emptyComments: { alignItems: "center", paddingTop: 32, paddingHorizontal: 32, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  commentRow: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    paddingHorizontal: 16, paddingVertical: 10,
  },
  commentBubble: { flex: 1, borderRadius: 14, padding: 10 },
  commentMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  commentAutor: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  commentTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  commentTexto: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 19 },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, fontFamily: "Inter_400Regular", maxHeight: 100,
  },
  sendIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
});
