import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";

type MetodoPagamento = "pix" | "cartao" | "apple_pay" | "google_pay";

interface MetodoConfig {
  id: MetodoPagamento;
  label: string;
  icon: string;
  desc: string;
}

const METODOS: MetodoConfig[] = [
  { id: "pix", label: "Pix", icon: "zap", desc: "Confirmação instantânea" },
  { id: "cartao", label: "Cartão de crédito", icon: "credit-card", desc: "Crédito ou débito" },
  { id: "apple_pay", label: "Apple Pay", icon: "smartphone", desc: "Face ID / Touch ID" },
  { id: "google_pay", label: "Google Pay", icon: "smartphone", desc: "Pagamento rápido" },
];

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CheckoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, totalValor, clearCart } = useCart();
  const { aluno } = useAuth();
  const [metodo, setMetodo] = useState<MetodoPagamento>("pix");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleConfirm() {
    if (!aluno) return;
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await new Promise((r) => setTimeout(r, 1200));
      clearCart();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/checkout-success");
    } catch (e: any) {
      setError(e?.message ?? "Erro ao processar pagamento. Tente novamente.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 16, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Checkout</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Order summary */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Resumo do pedido
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {items.map((item, i) => (
            <View
              key={item.product.id}
              style={[
                styles.itemRow,
                i < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.itemNome, { color: colors.foreground }]} numberOfLines={1}>
                {item.product.nome}
              </Text>
              <Text style={[styles.itemQtd, { color: colors.mutedForeground }]}>
                x{item.quantidade}
              </Text>
              <Text style={[styles.itemValor, { color: colors.foreground }]}>
                {formatBRL(item.product.valor * item.quantidade)}
              </Text>
            </View>
          ))}
          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text>
            <Text style={[styles.totalValor, { color: colors.primary }]}>
              {formatBRL(totalValor)}
            </Text>
          </View>
        </View>

        {/* Metodo */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Forma de pagamento
        </Text>
        <View style={styles.metodos}>
          {METODOS.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.metodoCard,
                {
                  backgroundColor: colors.card,
                  borderColor: metodo === m.id ? colors.primary : colors.border,
                  borderWidth: metodo === m.id ? 2 : 1,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMetodo(m.id);
              }}
            >
              <View
                style={[
                  styles.metodoIcon,
                  {
                    backgroundColor:
                      metodo === m.id ? colors.primary : colors.accent,
                  },
                ]}
              >
                <Feather
                  name={m.icon as any}
                  size={18}
                  color={metodo === m.id ? "#fff" : colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.metodoLabel, { color: colors.foreground }]}>
                  {m.label}
                </Text>
                <Text style={[styles.metodoDesc, { color: colors.mutedForeground }]}>
                  {m.desc}
                </Text>
              </View>
              {metodo === m.id && (
                <Feather name="check-circle" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* PIX QR placeholder */}
        {metodo === "pix" && (
          <View style={[styles.pixCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.pixTitle, { color: colors.foreground }]}>Código Pix</Text>
            <View style={[styles.pixQr, { backgroundColor: colors.muted }]}>
              <Feather name="maximize" size={48} color={colors.mutedForeground} />
              <Text style={[styles.pixQrText, { color: colors.mutedForeground }]}>
                QR Code gerado após confirmar
              </Text>
            </View>
          </View>
        )}

        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40" }]}>
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}
      </ScrollView>

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
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 },
          ]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="lock" size={18} color="#fff" />
              <Text style={styles.confirmBtnText}>Confirmar pagamento</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  content: { padding: 20, gap: 16 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  itemNome: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  itemQtd: { fontSize: 13, fontFamily: "Inter_400Regular" },
  itemValor: { fontSize: 14, fontFamily: "Inter_700Bold" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  totalLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  totalValor: { fontSize: 20, fontFamily: "Inter_700Bold" },
  metodos: { gap: 10 },
  metodoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 14,
  },
  metodoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  metodoLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  metodoDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  pixCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  pixTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  pixQr: {
    height: 160,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pixQrText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  errorText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  footer: { padding: 20, borderTopWidth: 1 },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  confirmBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
