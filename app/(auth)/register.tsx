import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
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

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { apiKey } = useAuth();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const passwordStrength =
    password.length === 0 ? 0 :
    password.length < 6 ? 0 :
    password.length < 10 ? 1 :
    password.length < 14 ? 2 : 3;

  const strengthLabel = ["Muito curta", "Fraca", "Boa", "Forte"][passwordStrength];
  const strengthColor = [colors.border, colors.destructive, colors.warning, colors.success][passwordStrength];

  const canSubmit = nome.trim().length >= 2 && email.trim().length > 0 && password.length >= 6 && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    if (!email.includes("@")) { setError("Informe um e-mail válido"); return; }
    if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres"); return; }

    setError("");
    setLoading(true);
    try {
      await averonApi.signupRequest(apiKey ?? "", email.trim().toLowerCase(), password, nome.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: "/(auth)/signup-confirm",
        params: { email: email.trim().toLowerCase() },
      });
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("email_in_use")) {
        setError("Este e-mail já está cadastrado. Tente fazer login.");
      } else if (msg.includes("signup_disabled")) {
        setError("Cadastro desativado pelo administrador.");
      } else if (msg.includes("rate_limited")) {
        setError("Muitas tentativas. Aguarde 10 minutos e tente novamente.");
      } else if (msg.includes("smtp_config_missing")) {
        setError("O envio de e-mail não está configurado. Contate o suporte.");
      } else if (msg === "network_error" || msg === "timeout") {
        setError("Sem conexão. Verifique sua rede e tente novamente.");
      } else {
        setError("Não foi possível criar a conta. Tente novamente.");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: topPad + 16, paddingBottom: bottomPad + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <View style={[styles.backBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </View>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="user-plus" size={30} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Criar conta</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Preencha seus dados para começar.{"\n"}Você receberá um código de confirmação por e-mail.
          </Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>

          {/* Nome */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Nome completo</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="user" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Seu nome"
                placeholderTextColor={colors.mutedForeground}
                value={nome}
                onChangeText={(t) => { setNome(t); setError(""); }}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="name"
                returnKeyType="next"
              />
            </View>
          </View>

          {/* E-mail */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>E-mail</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
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
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Senha */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Senha</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(""); }}
                secureTextEntry={!showPass}
                textContentType="newPassword"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity onPress={() => setShowPass((s) => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name={showPass ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Password strength */}
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[1, 2, 3].map((level) => (
                  <View
                    key={level}
                    style={[
                      styles.strengthBar,
                      { backgroundColor: passwordStrength >= level ? strengthColor : colors.border },
                    ]}
                  />
                ))}
                <Text style={[styles.strengthLabel, { color: colors.mutedForeground }]}>
                  {strengthLabel}
                </Text>
              </View>
            )}
          </View>

          {/* Error */}
          {!!error && (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={13} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.btn,
              { backgroundColor: canSubmit ? colors.primary : colors.muted, marginTop: 4 },
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={[styles.btnText, { color: canSubmit ? colors.primaryForeground : colors.mutedForeground }]}>
                  Criar conta
                </Text>
                {canSubmit && <Feather name="arrow-right" size={18} color={colors.primaryForeground} />}
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.terms, { color: colors.mutedForeground }]}>
          Ao criar uma conta você concorda com os termos de uso da plataforma.
        </Text>
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
    width: 76, height: 76, borderRadius: 38,
    alignItems: "center", justifyContent: "center", marginBottom: 18,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  formCard: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 16, marginBottom: 16 },
  fieldGroup: { gap: 7 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  strengthBar: { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 4 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 14,
  },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  terms: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
});
