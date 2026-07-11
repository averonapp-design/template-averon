import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { CartItem, Product, useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const colors = useColors();
  const { items, addItem } = useCart();
  const cartItem = items.find((i: CartItem) => i.product.id === product.id);

  function handleAdd() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addItem(product);
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: product.destaque ? colors.primary : colors.border,
          borderWidth: product.destaque ? 2 : 1,
        },
      ]}
      onPress={() => router.push(`/product/${product.id}`)}
      activeOpacity={0.85}
    >
      {product.destaque && (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
            Mais vendido
          </Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.header}>
          <View
            style={[
              styles.iconBox,
              { backgroundColor: colors.accent },
            ]}
          >
            <Feather
              name={
                product.categoria === "Planos" ? "layers" : "plus-circle"
              }
              size={20}
              color={colors.primary}
            />
          </View>
          <View style={styles.tags}>
            {product.tags?.slice(0, 1).map((tag) => (
              <View
                key={tag}
                style={[styles.tag, { backgroundColor: colors.secondary }]}
              >
                <Text style={[styles.tagText, { color: colors.secondaryForeground }]}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text
          style={[styles.categoria, { color: colors.mutedForeground }]}
        >
          {product.categoria}
        </Text>
        <Text
          style={[styles.nome, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {product.nome}
        </Text>
        <Text
          style={[styles.descricao, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {product.descricao}
        </Text>

        <View style={styles.footer}>
          <Text style={[styles.valor, { color: colors.primary }]}>
            {formatBRL(product.valor)}
          </Text>
          <TouchableOpacity
            style={[
              styles.addBtn,
              {
                backgroundColor: cartItem
                  ? colors.success
                  : colors.primary,
              },
            ]}
            onPress={handleAdd}
          >
            <Feather
              name={cartItem ? "check" : "shopping-cart"}
              size={14}
              color="#fff"
            />
            {cartItem && (
              <Text style={styles.addBtnText}>{cartItem.quantidade}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    margin: 12,
    marginBottom: 0,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  body: {
    padding: 14,
    gap: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tags: {
    flexDirection: "row",
    gap: 4,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  categoria: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  nome: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  descricao: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  valor: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
