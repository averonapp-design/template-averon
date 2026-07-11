import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function CheckoutSuccessScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scale = new Animated.Value(0);
  const opacity = new Animated.Value(0);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: topPad,
          paddingBottom: bottomPad + 32,
        },
      ]}
    >
      <Animated.View style={[styles.iconWrapper, { transform: [{ scale }] }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.success + "15" }]}>
          <View style={[styles.innerCircle, { backgroundColor: colors.success + "30" }]}>
            <Feather name="check" size={48} color={colors.success} />
          </View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.textBlock, { opacity }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Pagamento confirmado!</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Seu pedido foi processado com sucesso. Você receberá uma confirmação por e-mail.
        </Text>
      </Animated.View>

      <Animated.View style={[styles.actions, { opacity }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace("/(tabs)/orders")}
        >
          <Feather name="file-text" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Ver meus pedidos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
            Voltar ao início
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 32,
  },
  iconWrapper: { alignItems: "center" },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  innerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: { alignItems: "center", gap: 12 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center" },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  actions: { width: "100%", gap: 12 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  secondaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
