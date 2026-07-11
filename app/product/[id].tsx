import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCart } from "@/context/CartContext";
import { PRODUCTS } from "@/data/products";
import { useColors } from "@/hooks/useColors";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const FEATURES: Record<string, string[]> = {
  "plan-starter": [
    "Painel web Averon",
    "Até 3 usuários",
    "1.000 transações/mês",
    "Suporte por e-mail",
    "Relatórios básicos",
  ],
  "plan-pro": [
    "Tudo do Starter",
    "Até 10 usuários",
    "10.000 transações/mês",
    "Suporte prioritário",
    "Relatórios avançados",
    "API ilimitada",
    "Webhooks configuráveis",
  ],
  "plan-business": [
    "Tudo do Pro",
    "Usuários ilimitados",
    "SLA 99.9%",
    "Suporte dedicado",
    "Integrações premium",
    "Dashboard personalizado",
    "Onboarding guiado",
  ],
  "plan-enterprise": [
    "Tudo do Business",
    "Infraestrutura dedicada",
    "SLA 99.99%",
    "Gerente de conta exclusivo",
    "Onboarding personalizado",
    "Contrato customizado",
    "Treinamento incluído",
  ],
};

export default function ProductDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addItem, items } = useCart();

  const product = PRODUCTS.find((p) => p.id === id);
  const cartItem = items.find((i) => i.product.id === id);
  const features = FEATURES[id ?? ""] ?? [];

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
          Produto não encontrado
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.primary, paddingTop: topPad + 16 }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.heroContent}>
            <View style={[styles.heroIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <Feather
                name={product.categoria === "Planos" ? "layers" : "plus-circle"}
                size={36}
                color="#fff"
              />
            </View>
            {product.destaque && (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>Mais vendido</Text>
              </View>
            )}
            <Text style={styles.heroCategoria}>{product.categoria}</Text>
            <Text style={styles.heroNome}>{product.nome}</Text>
            <Text style={styles.heroValor}>
              {formatBRL(product.valor)}
              <Text style={styles.heroPeriodo}>
                {product.tags?.includes("único") ? " (pagamento único)" : "/mês"}
              </Text>
            </Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Descrição</Text>
          <Text style={[styles.descricao, { color: colors.mutedForeground }]}>
            {product.descricao}
          </Text>
        </View>

        {/* Features */}
        {features.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              O que está incluído
            </Text>
            <View style={[styles.featuresCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {features.map((f, i) => (
                <View
                  key={i}
                  style={[
                    styles.featureRow,
                    i < features.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.featureCheck, { backgroundColor: colors.success + "20" }]}>
                    <Feather name="check" size={12} color={colors.success} />
                  </View>
                  <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Tags */}
        {product.tags && product.tags.length > 0 && (
          <View style={[styles.section, { flexDirection: "row", gap: 8, flexWrap: "wrap" }]}>
            {product.tags.map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.tagText, { color: colors.secondaryForeground }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add to cart fixed footer */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: bottomPad + 16,
          },
        ]}
      >
        {cartItem ? (
          <View style={styles.footerRow}>
            <View style={[styles.inCartBadge, { backgroundColor: colors.success + "15" }]}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={[styles.inCartText, { color: colors.success }]}>
                {cartItem.quantidade}x no carrinho
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                addItem(product);
              }}
            >
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Adicionar mais</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addBtn, styles.addBtnFull, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              addItem(product);
            }}
          >
            <Feather name="shopping-cart" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Adicionar ao carrinho</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  heroContent: { alignItems: "flex-start", gap: 8 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  heroBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  heroBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  heroCategoria: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_500Medium", letterSpacing: 0.5, textTransform: "uppercase" },
  heroNome: { color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold", lineHeight: 32 },
  heroValor: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold" },
  heroPeriodo: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 12 },
  descricao: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  featuresCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  featureCheck: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  featureText: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tagText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  footer: { padding: 20, borderTopWidth: 1 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  inCartBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  inCartText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14 },
  addBtnFull: { width: "100%" },
  addBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
