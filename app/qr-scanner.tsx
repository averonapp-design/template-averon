import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function QRScannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  function handleWebScan() {
    setScanned(true);
    setResult("AVERON-PROMO-10PCT-2026");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  if (scanned && result) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>QR Scanner</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.resultContainer}>
          <View style={[styles.successCircle, { backgroundColor: colors.success + "15" }]}>
            <Feather name="check-circle" size={48} color={colors.success} />
          </View>
          <Text style={[styles.resultTitle, { color: colors.foreground }]}>
            Código lido!
          </Text>
          <View style={[styles.codeBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.codeText, { color: colors.primary }]}>{result}</Text>
          </View>
          <Text style={[styles.resultDesc, { color: colors.mutedForeground }]}>
            Desconto de 10% aplicado automaticamente no próximo checkout.
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={() => {
              setScanned(false);
              setResult(null);
            }}
          >
            <Feather name="maximize" size={18} color="#fff" />
            <Text style={styles.btnText}>Escanear outro</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSecondary, { borderColor: colors.border }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.btnSecondaryText, { color: colors.foreground }]}>
              Fechar
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>QR Scanner</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.webFallback}>
          <View style={[styles.webFallbackIcon, { backgroundColor: colors.accent }]}>
            <Feather name="camera-off" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.webFallbackTitle, { color: colors.foreground }]}>
            Scanner disponível no app
          </Text>
          <Text style={[styles.webFallbackDesc, { color: colors.mutedForeground }]}>
            Para escanear QR Codes promocionais, use o Averon no seu celular via Expo Go.
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={handleWebScan}
          >
            <Feather name="zap" size={18} color="#fff" />
            <Text style={styles.btnText}>Simular scan (demo)</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View
        style={[
          styles.scannerOverlay,
          { paddingTop: topPad, paddingBottom: bottomPad },
        ]}
      >
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: "rgba(0,0,0,0.6)" }]}
          onPress={() => router.back()}
        >
          <Feather name="x" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        <View style={styles.scanHint}>
          <Feather name="maximize" size={24} color="#fff" />
          <Text style={styles.scanHintText}>
            Aponte para o QR Code promocional
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.simulateBtn, { backgroundColor: colors.primary }]}
          onPress={handleWebScan}
        >
          <Text style={styles.simulateBtnText}>Simular leitura (dev)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  resultContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  resultTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  codeBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
  },
  codeText: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  resultDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  btnSecondary: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  btnSecondaryText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  webFallbackIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  webFallbackTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  webFallbackDesc: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  scannerOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
  },
  closeBtn: {
    alignSelf: "flex-start",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#fff",
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanHint: { alignItems: "center", gap: 8 },
  scanHintText: { color: "#fff", fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center" },
  simulateBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  simulateBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold" },
});
