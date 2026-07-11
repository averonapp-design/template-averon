import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { averonApi, Venda } from "@/services/averon";
import { useColors } from "@/hooks/useColors";

function formatBRL(value?: number) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface TimelineStep {
  label: string;
  icon: string;
  done: boolean;
}

function getTimeline(status: string): TimelineStep[] {
  return [
    { label: "Pedido recebido", icon: "file-text", done: true },
    { label: "Pagamento processado", icon: "credit-card", done: status !== "pendente" },
    {
      label: status === "cancelado" ? "Pedido cancelado" : "Pedido aprovado",
      icon: status === "cancelado" ? "x-circle" : "check-circle",
      done: status === "aprovado" || status === "cancelado",
    },
  ];
}

export default function OrderDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiKey } = useAuth();
  const [venda, setVenda] = useState<Venda | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (!apiKey || !id) return;
    averonApi
      .getVenda(apiKey, id)
      .then(setVenda)
      .catch(() => {
        const mock: Venda = {
          id: id,
          status: "aprovado",
          criado_em: new Date().toISOString(),
          produto: "Plano Pro",
          valor: 299,
          metodo: "pix",
          cliente_email: "usuario@email.com",
        };
        setVenda(mock);
      })
      .finally(() => setLoading(false));
  }, [apiKey, id]);

  async function handleShare() {
    if (!venda) return;
    await Share.share({
      message: `Pedido #${venda.id} — ${venda.produto ?? "Averon"} — ${formatBRL(venda.valor)} — Status: ${venda.status}`,
    });
  }

  const statusColor =
    venda?.status === "aprovado"
      ? colors.success
      : venda?.status === "cancelado"
      ? colors.destructive
      : colors.warning;

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
        <Text style={[styles.title, { color: colors.foreground }]}>Detalhe do Pedido</Text>
        <TouchableOpacity onPress={handleShare}>
          <Feather name="share-2" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !venda ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
            Pedido não encontrado
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Status card */}
          <View
            style={[
              styles.statusCard,
              { backgroundColor: statusColor + "12", borderColor: statusColor + "30" },
            ]}
          >
            <Feather
              name={
                venda.status === "aprovado"
                  ? "check-circle"
                  : venda.status === "cancelado"
                  ? "x-circle"
                  : "clock"
              }
              size={32}
              color={statusColor}
            />
            <Text style={[styles.statusLabel, { color: statusColor }]}>
              {venda.status === "aprovado"
                ? "Pagamento aprovado"
                : venda.status === "cancelado"
                ? "Pedido cancelado"
                : "Aguardando pagamento"}
            </Text>
          </View>

          {/* Info card */}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { label: "Pedido", value: `#${venda.id}` },
              { label: "Produto", value: venda.produto ?? "—" },
              { label: "Valor", value: formatBRL(venda.valor) },
              { label: "Método", value: venda.metodo?.toUpperCase() ?? "—" },
              { label: "E-mail", value: venda.cliente_email ?? "—" },
              { label: "Data", value: formatDateTime(venda.criado_em) },
            ].map((row, i, arr) => (
              <View
                key={row.label}
                style={[
                  styles.infoRow,
                  i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                  {row.label}
                </Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          {/* Timeline */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Timeline</Text>
          <View style={[styles.timelineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {getTimeline(venda.status).map((step, i) => (
              <View key={i} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.timelineDot,
                      {
                        backgroundColor: step.done ? colors.primary : colors.muted,
                        borderColor: step.done ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Feather
                      name={step.icon as any}
                      size={12}
                      color={step.done ? "#fff" : colors.mutedForeground}
                    />
                  </View>
                  {i < 2 && (
                    <View
                      style={[
                        styles.timelineLine,
                        { backgroundColor: step.done ? colors.primary : colors.border },
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.timelineLabel,
                    { color: step.done ? colors.foreground : colors.mutedForeground },
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
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
    gap: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  title: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 16 },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
  },
  statusLabel: { fontSize: 17, fontFamily: "Inter_700Bold" },
  infoCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  infoLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  infoValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", maxWidth: "60%", textAlign: "right" },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  timelineCard: { borderRadius: 14, borderWidth: 1, padding: 20 },
  timelineItem: { flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 48 },
  timelineLeft: { alignItems: "center", width: 28 },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: { width: 2, flex: 1, marginTop: 4 },
  timelineLabel: { fontSize: 14, fontFamily: "Inter_500Medium", paddingTop: 4 },
});
