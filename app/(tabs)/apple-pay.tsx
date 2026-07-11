import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useInAppBrowser } from "@/context/InAppBrowserContext";
import { useColors } from "@/hooks/useColors";
import { useApplePay } from "@/hooks/useApplePay";
import { averonApi, ApplePaymentProduto } from "@/services/averon";

const AVERON_SITE = "https://www.averonapp.com";

export default function ApplePayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { apiKey, alunoToken } = useAuth();
  const { openUrl } = useInAppBrowser();
  const { enabled, produtos, loading, error, refresh, siteCheckoutUrl } = useApplePay(apiKey, alunoToken);
  const [purchasingId, setPurchasingId] = useState<number | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 90 : insets.bottom + 90;

  async function handleComprar(produto: ApplePaymentProduto) {
    if (!apiKey || !alunoToken || purchasingId !== null) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPurchasingId(produto.id);

    try {
      // ── Strategy 1: product already has a checkout URL ────────────────────
      const prodUrl = produto.checkout_url ?? produto.link ?? produto.cta_url;
      if (prodUrl) {
        openUrl(prodUrl, `Comprar — ${produto.nome}`);
        return;
      }

      // ── Strategy 2: call purchase endpoint ────────────────────────────────
      let checkoutUrl: string | null = null;
      try {
        const res = await averonApi.purchaseApplePayProduct(apiKey, alunoToken, produto.id);
        if (res.checkout_url) {
          checkoutUrl = res.checkout_url;
        } else if (res.ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Compra iniciada", res.message ?? "Você receberá uma confirmação em breve.", [{ text: "OK" }]);
          return;
        }
      } catch {
        // purchase endpoint failed — try site-level fallback below
      }

      // ── Strategy 3: site-wide checkout URL from status response ───────────
      if (!checkoutUrl) {
        checkoutUrl = siteCheckoutUrl;
      }

      if (checkoutUrl) {
        openUrl(checkoutUrl, `Comprar — ${produto.nome}`);
        return;
      }

      // ── Strategy 4: open averonapp.com as last resort ─────────────────────
      Alert.alert(
        "Finalizar compra no site",
        `Não foi possível processar o pagamento diretamente. Deseja abrir o site para concluir a compra de "${produto.nome}"?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Abrir site",
            onPress: () => openUrl(AVERON_SITE, "Comprar"),
          },
        ]
      );
    } finally {
      setPurchasingId(null);
    }
  }

  if (Platform.OS !== "ios") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Feather name="smartphone" size={44} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground, marginTop: 16 }]}>
          Disponível apenas no iOS
        </Text>
        <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
          Compras via Apple Pay são exclusivas para dispositivos Apple.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!enabled) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Feather name="credit-card" size={44} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground, marginTop: 16 }]}>
          Pagamento Apple desativado
        </Text>
        <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
          Essa funcionalidade não está disponível no momento.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => refresh(true)} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Comprar</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Adquira acesso via Apple Pay
        </Text>
      </View>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: colors.destructive + "15" }]}>
          <Feather name="alert-circle" size={14} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            Não foi possível carregar os produtos. Puxe para atualizar.
          </Text>
        </View>
      )}

      <View style={{ padding: 16, gap: 12 }}>
        {produtos.map((p) => {
          const isBuying = purchasingId === p.id;
          const anyBuying = purchasingId !== null;
          return (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.8}
              disabled={anyBuying}
              onPress={() => handleComprar(p)}
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: anyBuying && !isBuying ? 0.5 : 1,
                },
              ]}
            >
              <View style={styles.cardTop}>
                <View style={[styles.iconBox, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name="shopping-bag" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.prodName, { color: colors.foreground }]} numberOfLines={2}>
                    {p.nome}
                  </Text>
                  {!!p.descricao && (
                    <Text style={[styles.prodDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {p.descricao}
                    </Text>
                  )}
                </View>
                <View style={[styles.priceTag, { backgroundColor: colors.primary + "15" }]}>
                  <Text style={[styles.priceText, { color: colors.primary }]}>
                    R$ {p.preco.toFixed(2).replace(".", ",")}
                  </Text>
                </View>
              </View>

              <View style={[styles.buyBtn, { backgroundColor: isBuying ? colors.primary + "99" : colors.primary }]}>
                {isBuying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="shopping-cart" size={14} color="#fff" />
                    <Text style={[styles.buyBtnText, { color: "#fff" }]}>
                      Comprar com Apple Pay
                    </Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {produtos.length === 0 && !error && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="package" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, marginTop: 12 }]}>
              Nenhum produto disponível
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Volte mais tarde para conferir novas ofertas.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 16, marginBottom: 0, padding: 12, borderRadius: 10,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  card: {
    borderRadius: 16, borderWidth: 1,
    padding: 16, gap: 14,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  prodName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  prodDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 2 },
  priceTag: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  priceText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  buyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 12, minHeight: 44,
  },
  buyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyCard: {
    alignItems: "center", padding: 32,
    borderRadius: 16, borderWidth: 1,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 6 },
});
