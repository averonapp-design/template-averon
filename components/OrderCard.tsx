import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Venda } from "@/services/averon";
import { useColors } from "@/hooks/useColors";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatBRL(value?: number) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

interface StatusConfig {
  label: string;
  color: string;
  icon: string;
}

function getStatusConfig(
  status: string,
  colors: ReturnType<typeof useColors>
): StatusConfig {
  switch (status) {
    case "aprovado":
      return { label: "Aprovado", color: colors.success, icon: "check-circle" };
    case "cancelado":
      return {
        label: "Cancelado",
        color: colors.destructive,
        icon: "x-circle",
      };
    default:
      return {
        label: "Pendente",
        color: colors.warning,
        icon: "clock",
      };
  }
}

interface OrderCardProps {
  venda: Venda;
}

export function OrderCard({ venda }: OrderCardProps) {
  const colors = useColors();
  const statusConfig = getStatusConfig(venda.status, colors);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={() => router.push(`/order/${venda.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <Text style={[styles.id, { color: colors.mutedForeground }]}>
          #{venda.id}
        </Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: `${statusConfig.color}18` },
          ]}
        >
          <Feather
            name={statusConfig.icon as any}
            size={12}
            color={statusConfig.color}
          />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <Text style={[styles.produto, { color: colors.foreground }]}>
        {venda.produto ?? "Pedido Averon"}
      </Text>
      <Text style={[styles.data, { color: colors.mutedForeground }]}>
        {formatDate(venda.criado_em)}
      </Text>

      <View style={styles.footer}>
        <Text style={[styles.valor, { color: colors.primary }]}>
          {formatBRL(venda.valor)}
        </Text>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  id: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  produto: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  data: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  valor: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
});
