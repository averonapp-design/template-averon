import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { averonApi } from "@/services/averon";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { apiKey } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleSend() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError("Informe seu e-mail"); return; }
    if (!trimmed.includes("@")) { setError("E-mail inválido"); return; }
    setError("");
    setLoading(true);
    try {
      await averonApi.requestPasswordReset(apiKey ?? "", trimmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch {
      setError("Não foi possível enviar o código. Tente novamente.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  function handleGoToCode() {
    router.push({ pathname: "/(auth)/otp", params: { email: email.trim().toLowerCase() } });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: topPad + 16, paddingBottom: bottomPad + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <View style={[styles.backBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </View>
        </TouchableOpacity>

        {!sent ? (
          <>
            <View style={styles.header}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primary + "15" }]}>
                <Feather name="key" size={30} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.foreground }]}>
                Recuperar senha
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Informe seu e-mail cadastrado e enviaremos um código de 6 dígitos para criar uma nova senha.
              </Text>
            </View>

            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>E-mail</Text>
              <View style={[
                styles.inputRow,
                { backgroundColor: colors.background, borderColor: error ? colors.destructive : colors.border },
              ]}>
                <Feather name="mail" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="seuemail@exemplo.com"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(""); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                />
              </View>
              {!!error && (
                <View style={styles.errorRow}>
                  <Feather name="alert-circle" size={12} color={colors.destructive} />
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.btn,
                  { backgroundColor: email.trim() && !loading ? colors.primary : colors.muted },
                ]}
                onPress={handleSend}
                disabled={!email.trim() || loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={[
                      styles.btnText,
                      { color: email.trim() ? colors.primaryForeground : colors.mutedForeground },
                    ]}>
                      Enviar código
                    </Text>
                    {!!email.trim() && <Feather name="send" size={16} color={colors.primaryForeground} />}
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.accent + "40", borderColor: colors.accent }]}>
              <Feather name="info" size={14} color={colors.primary} style={{ marginTop: 1 }} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                O código expira em 15 minutos. Verifique também sua pasta de spam.
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.successContainer}>
            <View style={[styles.successCircle, { backgroundColor: colors.success + "18" }]}>
              <Feather name="mail" size={40} color={colors.success} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Código enviado!
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Enviamos um código de 6 dígitos para{"\n"}
              <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                {email.trim().toLowerCase()}
              </Text>
            </Text>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, marginTop: 32, width: "100%" }]}
              onPress={handleGoToCode}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
                Inserir o código
              </Text>
              <Feather name="arrow-right" size={16} color={colors.primaryForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resendBtn, { marginTop: 12 }]}
              onPress={() => { setSent(false); }}
            >
              <Text style={[styles.resendText, { color: colors.mutedForeground }]}>
                E-mail errado? Corrigir
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: { marginBottom: 24 },
  backBadge: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  header: { alignItems: "center", marginBottom: 28 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 10, textAlign: "center", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 23 },
  formCard: {
    borderRadius: 20, borderWidth: 1, padding: 20, gap: 12, marginBottom: 16,
  },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 14, marginTop: 4,
  },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  infoBox: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  successContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 40 },
  successCircle: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  resendBtn: { padding: 12 },
  resendText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
