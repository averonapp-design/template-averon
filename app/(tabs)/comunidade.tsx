import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import { ImageGrid } from "@/components/ImageGrid";
import { useColors } from "@/hooks/useColors";
import { averonApi, ComunidadePost, ComunidadeStatus } from "@/services/averon";

function formatPrice(centavos: number, moeda: string): string {
  const value = (centavos / 100).toFixed(2).replace(".", ",");
  if (moeda === "BRL") return `R$ ${value}`;
  return `${moeda} ${value}`;
}

function duracaoLabel(d: string): string {
  const map: Record<string, string> = {
    diario: "1 dia", semanal: "1 semana", mensal: "1 mês",
    trimestral: "3 meses", semestral: "6 meses", anual: "1 ano", vitalicio: "vitalício",
  };
  return map[d] ?? d;
}

function duracaoBtnLabel(d: string): string {
  if (d === "vitalicio") return "Comprar acesso vitalício";
  return `Comprar acesso de ${duracaoLabel(d)}`;
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function Avatar({ nome, url, size = 38, primary }: { nome: string; url?: string | null; size?: number; primary: string }) {
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: primary + "22", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: size * 0.4, fontFamily: "Inter_700Bold", color: primary }}>{(nome ?? "?")[0].toUpperCase()}</Text>
    </View>
  );
}

interface PostCardProps {
  post: ComunidadePost;
  meId: string;
  colors: any;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
}

function PostCard({ post, meId, colors, onLike, onComment }: PostCardProps) {
  const isMe = post.autor.id === meId;
  const isPending = post.status === "pending";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: isPending ? colors.warning + "60" : colors.border }]}>
      {isPending && isMe && (
        <View style={[styles.pendingBanner, { backgroundColor: colors.warning + "15" }]}>
          <Feather name="clock" size={12} color={colors.warning} />
          <Text style={[styles.pendingText, { color: colors.warning }]}>Aguardando aprovação</Text>
        </View>
      )}
      <View style={styles.cardHeader}>
        <Avatar nome={post.autor.nome} url={post.autor.avatar_url} primary={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.autorNome, { color: colors.foreground }]}>
            {post.autor.nome}{isMe ? <Text style={{ color: colors.primary }}> (você)</Text> : ""}
          </Text>
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

      <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onLike(post.id)} activeOpacity={0.7}>
          <Feather name="heart" size={18} color={post.liked_by_me ? "#EF4444" : colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: post.liked_by_me ? "#EF4444" : colors.mutedForeground }]}>
            {post.likes_count}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onComment(post.id)} activeOpacity={0.7}>
          <Feather name="message-circle" size={18} color={colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{post.comments_count}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ComunidadeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { aluno, apiKey, alunoToken } = useAuth();
  const { openUrl } = useInAppBrowser();

  const [comunidadeStatus, setComunidadeStatus] = useState<ComunidadeStatus | null>(null);
  const [posts, setPosts] = useState<ComunidadePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Compose modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [novoTexto, setNovoTexto] = useState("");
  const [pickedImages, setPickedImages] = useState<{ uri: string; mimeType: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 90 : insets.bottom + 90;

  async function fetchPosts(isRefresh = false) {
    if (!apiKey || !alunoToken) { setLoading(false); setRefreshing(false); return; }
    if (!isRefresh) setLoadError(false);
    try {
      // Check community access status first
      const status = await averonApi.getComunidadeStatus(apiKey, alunoToken);
      setComunidadeStatus(status);

      // If locked (paywall), stop here — no need to fetch posts
      if (status.locked) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const res: any = await averonApi.getComunidadePosts(apiKey, alunoToken);
      if (res?.ok === false) {
        const err = res?.error ?? "";
        if (err.includes("disabled") || err.includes("desativad") || err.includes("403")) {
          setDisabled(true);
          return;
        }
      }
      setDisabled(false);
      const list: ComunidadePost[] = res.posts ?? [];
      setPosts(Array.isArray(list) ? list : []);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("403") || msg.includes("disabled") || msg.includes("desativad")) {
        setDisabled(true);
      } else {
        setLoadError(true);
      }
      if (!isRefresh) setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchPosts(); }, [apiKey, alunoToken]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts(true);
  }, [apiKey, alunoToken]);

  async function handleLike(postId: string) {
    if (!apiKey || !alunoToken) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Capture state before optimistic update so rollback is reliable
    const current = posts.find((p) => p.id === postId);
    if (!current) return;
    const wasLiked = current.liked_by_me;
    const prevCount = current.likes_count;

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked_by_me: !wasLiked, likes_count: wasLiked ? prevCount - 1 : prevCount + 1 }
          : p
      )
    );
    try {
      const res = await averonApi.likeComunidadePost(apiKey, alunoToken, postId);
      if (res.ok && typeof res.liked === "boolean" && typeof res.likes_count === "number") {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, liked_by_me: res.liked, likes_count: res.likes_count } : p
          )
        );
        // Fire XP event only when actually liking (not unliking)
        if (res.liked && aluno?.id) {
          averonApi.postEvento(apiKey, aluno.id, "community_like", { post_id: postId }).catch(() => {});
        }
      }
    } catch {
      // Revert to the state captured before the action
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, liked_by_me: wasLiked, likes_count: prevCount } : p
        )
      );
    }
  }

  async function pickImages() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Permita acesso à galeria para adicionar fotos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.85,
    });
    if (result.canceled) return;
    // Compress each picked image to JPEG so uploads are reliable on iOS (avoids HEIC)
    const items: { uri: string; mimeType: string }[] = [];
    for (const a of result.assets) {
      try {
        const m = await ImageManipulator.manipulateAsync(
          a.uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        items.push({ uri: m.uri, mimeType: "image/jpeg" });
      } catch {
        items.push({ uri: a.uri, mimeType: a.mimeType ?? "image/jpeg" });
      }
    }
    setPickedImages((prev) => [...prev, ...items].slice(0, 4));
  }

  async function doPost(imageUrls: string[]) {
    const res = await averonApi.createComunidadePost(apiKey!, alunoToken!, novoTexto.trim(), imageUrls);
    setNovoTexto("");
    setPickedImages([]);
    setComposeOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Fire XP event for community post (fire-and-forget)
    if (aluno?.id) {
      averonApi.postEvento(apiKey!, aluno.id, "community_post").catch(() => {});
    }

    if (res.status === "approved") {
      fetchPosts(true);
    } else {
      Alert.alert(
        "Publicação enviada!",
        "Sua publicação foi enviada e aparecerá na comunidade após aprovação.",
        [{ text: "OK" }]
      );
      fetchPosts(true);
    }
  }

  async function handlePost() {
    if (!novoTexto.trim() && pickedImages.length === 0) return;
    if (!apiKey || !alunoToken) return;

    setPosting(true);

    // Step 1: upload images (if any)
    let imageUrls: string[] = [];
    if (pickedImages.length > 0) {
      setUploading(true);
      try {
        imageUrls = await Promise.all(
          pickedImages.map((img) =>
            averonApi
              .uploadComunidadeMedia(apiKey, alunoToken, img.uri, img.mimeType)
              .then((r) => r.url)
          )
        );
      } catch {
        setUploading(false);
        setPosting(false);
        // Upload endpoint not available — offer to post text only
        if (novoTexto.trim()) {
          Alert.alert(
            "Fotos indisponíveis",
            "Não foi possível enviar as fotos. Deseja publicar só o texto?",
            [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Publicar sem fotos",
                onPress: async () => {
                  setPosting(true);
                  try {
                    await doPost([]);
                  } catch {
                    Alert.alert("Erro", "Não foi possível publicar. Tente novamente.");
                  } finally {
                    setPosting(false);
                  }
                },
              },
            ]
          );
        } else {
          Alert.alert("Erro", "Não foi possível enviar as fotos. Tente novamente.");
        }
        return;
      } finally {
        setUploading(false);
      }
    }

    // Step 2: create the post
    try {
      await doPost(imageUrls);
    } catch {
      Alert.alert("Erro", "Não foi possível publicar. Tente novamente.");
    } finally {
      setPosting(false);
    }
  }

  function openCompose() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNovoTexto("");
    setPickedImages([]);
    setComposeOpen(true);
  }

  const canPost = (novoTexto.trim().length > 0 || pickedImages.length > 0) && !posting;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Comunidade</Text>
        {!disabled && !loadError && (
          <TouchableOpacity style={[styles.newBtn, { backgroundColor: colors.primary }]} onPress={openCompose}>
            <Feather name="edit-3" size={14} color="#fff" />
            <Text style={styles.newBtnText}>Publicar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Feed */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : comunidadeStatus?.locked ? (
        /* ── Paywall ── */
        <View style={styles.paywallWrap}>
          <View style={[styles.paywallCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.paywallIconWrap, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="lock" size={30} color={colors.primary} />
            </View>
            <Text style={[styles.paywallTitle, { color: colors.foreground }]}>Acesso exclusivo</Text>
            {!!comunidadeStatus.descricao && (
              <Text style={[styles.paywallDesc, { color: colors.mutedForeground }]}>
                {comunidadeStatus.descricao}
              </Text>
            )}
            {!!comunidadeStatus.preco_centavos && (
              <View style={[styles.priceRow, { backgroundColor: colors.primary + "0E", borderColor: colors.primary + "30" }]}>
                <Text style={[styles.priceValue, { color: colors.primary }]}>
                  {formatPrice(comunidadeStatus.preco_centavos, comunidadeStatus.moeda ?? "BRL")}
                </Text>
                {!!comunidadeStatus.acesso_duracao && (
                  <View style={[styles.duracaoBadge, { backgroundColor: colors.primary + "20" }]}>
                    <Text style={[styles.duracaoBadgeText, { color: colors.primary }]}>
                      {duracaoLabel(comunidadeStatus.acesso_duracao)}
                    </Text>
                  </View>
                )}
              </View>
            )}
            {!!comunidadeStatus.checkout_url && (
              <TouchableOpacity
                style={[styles.paywallBtn, { backgroundColor: colors.primary }]}
                onPress={() => openUrl(comunidadeStatus.checkout_url!, "Comunidade")}
                activeOpacity={0.85}
              >
                <Feather name="shopping-cart" size={16} color="#fff" />
                <Text style={styles.paywallBtnText}>
                  {comunidadeStatus.acesso_duracao
                    ? duracaoBtnLabel(comunidadeStatus.acesso_duracao)
                    : "Comprar acesso"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : disabled ? (
        <View style={styles.center}>
          <View style={[styles.disabledIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="lock" size={28} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Comunidade desativada</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            O administrador desativou a comunidade por enquanto.
          </Text>
        </View>
      ) : loadError ? (
        <View style={styles.center}>
          <View style={[styles.disabledIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="wifi-off" size={28} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Não foi possível carregar</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Verifique sua conexão e tente novamente.
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => { setLoading(true); fetchPosts(); }}
          >
            <Feather name="refresh-cw" size={14} color="#fff" />
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: bottomPad, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            comunidadeStatus?.modo === "paid" && !comunidadeStatus.locked && comunidadeStatus.expires_at ? (
              <View style={[styles.expiryBanner, { backgroundColor: colors.warning + "18", borderColor: colors.warning + "40" }]}>
                <Feather name="clock" size={14} color={colors.warning} />
                <Text style={[styles.expiryText, { color: colors.mutedForeground }]}>
                  Seu acesso expira em{" "}
                  <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                    {new Date(comunidadeStatus.expires_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </Text>
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma publicação ainda</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>Seja o primeiro a compartilhar algo!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              meId={aluno?.id ?? ""}
              colors={colors}
              onLike={handleLike}
              onComment={(id) => router.push(`/comunidade/${id}` as any)}
            />
          )}
        />
      )}

      {/* Compose Modal */}
      <Modal
        visible={composeOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setComposeOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Modal header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setComposeOpen(false)} style={styles.modalCloseBtn}>
              <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Nova publicação</Text>
            <TouchableOpacity
              style={[styles.modalPostBtn, { backgroundColor: canPost ? colors.primary : colors.muted }]}
              onPress={handlePost}
              disabled={!canPost}
            >
              {posting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.modalPostText, { color: canPost ? "#fff" : colors.mutedForeground }]}>
                  {uploading ? "Enviando…" : "Publicar"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Compose body */}
          <View style={styles.composeBody}>
            <Avatar nome={aluno?.nome ?? "?"} url={aluno?.avatar_url} size={42} primary={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.composeName, { color: colors.foreground }]}>{aluno?.nome ?? ""}</Text>
              <TextInput
                style={[styles.composeInput, { color: colors.foreground }]}
                placeholder="O que você está pensando?"
                placeholderTextColor={colors.mutedForeground}
                multiline
                value={novoTexto}
                onChangeText={setNovoTexto}
                autoFocus
              />
            </View>
          </View>

          {/* Image previews */}
          {pickedImages.length > 0 && (
            <View style={styles.previewGrid}>
              {pickedImages.map((img, i) => (
                <View key={i} style={styles.previewItem}>
                  <Image source={{ uri: img.uri }} style={styles.previewImg} resizeMode="cover" />
                  <Pressable
                    style={[styles.previewRemove, { backgroundColor: colors.destructive }]}
                    onPress={() => setPickedImages((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Feather name="x" size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Toolbar */}
          <View style={[styles.composeToolbar, { borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity
              style={[styles.toolbarBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pickedImages.length >= 4 ? 0.4 : 1 }]}
              onPress={pickImages}
              disabled={pickedImages.length >= 4}
            >
              <Feather name="image" size={16} color={colors.primary} />
              <Text style={[styles.toolbarBtnText, { color: colors.foreground }]}>
                Foto{pickedImages.length > 0 ? ` (${pickedImages.length}/4)` : ""}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 24, fontFamily: "Inter_700Bold" },
  newBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  newBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  // Pending banner
  pendingBanner: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  pendingText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  // Cards
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingBottom: 10 },
  autorNome: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  autorTime: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  postTexto: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22, paddingHorizontal: 14, paddingBottom: 12 },
  cardActions: {
    flexDirection: "row", gap: 20, paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionCount: { fontSize: 14, fontFamily: "Inter_500Medium" },
  // States
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  disabledIcon: {
    width: 70, height: 70, borderRadius: 22, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },
  // Compose modal
  modalHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalCloseBtn: { paddingVertical: 6, paddingRight: 12 },
  modalCancelText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  modalTitle: { flex: 1, textAlign: "center", fontSize: 16, fontFamily: "Inter_700Bold" },
  modalPostBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, minWidth: 80, alignItems: "center",
  },
  modalPostText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  composeBody: { flexDirection: "row", gap: 12, padding: 16, alignItems: "flex-start" },
  composeName: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  composeInput: {
    fontSize: 16, fontFamily: "Inter_400Regular", lineHeight: 24,
    minHeight: 80, textAlignVertical: "top",
  },
  previewGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    paddingHorizontal: 16, marginBottom: 8,
  },
  previewItem: { position: "relative" },
  previewImg: { width: 80, height: 80, borderRadius: 10 },
  previewRemove: {
    position: "absolute", top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  composeToolbar: {
    flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolbarBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1,
  },
  toolbarBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  // Paywall
  paywallWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  paywallCard: {
    width: "100%", maxWidth: 360, borderRadius: 24, borderWidth: 1,
    padding: 28, alignItems: "center", gap: 14,
  },
  paywallIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  paywallTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center", letterSpacing: -0.4 },
  paywallDesc: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  priceRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, width: "100%",
  },
  priceValue: { fontSize: 22, fontFamily: "Inter_700Bold", flex: 1 },
  duracaoBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  duracaoBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  paywallBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15, borderRadius: 14, width: "100%",
  },
  paywallBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  // Expiry banner
  expiryBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 4,
  },
  expiryText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, marginTop: 4,
  },
  retryBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
