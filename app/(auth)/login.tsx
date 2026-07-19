import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";

const ADMIN_PASSWORD = "Ei14070052##";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, loginWithBiometrics, hasBiometricCredentials, apiKey, authConfig } = useAuth();
  const { brandName, logoUrl } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [adminPassError, setAdminPassError] = useState("");
  const [showAdminPass, setShowAdminPass] = useState(false);

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioType, setBioType] = useState<"face" | "fingerprint" | "iris">("face");
  const [bioLoading, setBioLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    checkBiometrics();
    AsyncStorage.getItem("averon_logout_reason").then((reason) => {
      if (reason === "outro_dispositivo") {
        setError("Sua sessão foi encerrada porque você entrou em outro aparelho.");
        AsyncStorage.removeItem("averon_logout_reason").catch(() => {});
      }
    }).catch(() => {});
  }, []);

  async function checkBiometrics() {
    if (Platform.OS === "web") return;
    try {
      const [hasHw, isEnrolled, hasCreds] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        hasBiometricCredentials(),
      ]);
      if (!hasHw || !isEnrolled || !hasCreds) return;
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBioType("face");
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        setBioType("iris");
      } else {
        setBioType("fingerprint");
      }
      setBioAvailable(true);
    } catch {
      setBioAvailable(false);
    }
  }

  async function handleBiometricLogin() {
    setBioLoading(true);
    setError("");
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: bioType === "face" ? "Entre com Face ID" : "Entre com sua biometria",
        cancelLabel: "Cancelar",
        disableDeviceFallback: true,
      });
      if (!result.success) {
        if (result.error !== "user_cancel" && result.error !== "system_cancel") {
          setError("Autenticação biométrica falhou. Use e-mail e senha.");
        }
        return;
      }
      await loginWithBiometrics();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg === "no_credentials") {
        setBioAvailable(false);
      } else if (msg.includes("API Key")) {
        setError("App não configurado. Aguarde o administrador.");
      } else if (msg === "timeout" || msg === "network_error") {
        setError("Sem conexão. Verifique sua rede.");
      } else {
        setError("Não foi possível entrar. Tente com e-mail e senha.");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBioLoading(false);
    }
  }

  async function handleLogin() {
    if (!email.trim()) { setError("Informe seu e-mail"); return; }
    if (!password) { setError("Informe sua senha"); return; }
    setError("");
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
      // Fire daily_login event for XP (fire-and-forget after navigation)
      // apiKey comes from AuthContext after login completes
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg === "invalid_credentials" || msg.includes("Credenciais")) {
        setError("E-mail ou senha incorretos");
      } else if (msg.includes("API Key")) {
        setError("App não configurado. Aguarde o administrador.");
      } else if (msg === "timeout") {
        setError("Servidor demorou para responder. Tente novamente.");
      } else if (msg === "network_error") {
        setError("Sem conexão com a internet. Verifique sua rede.");
      } else {
        setError("Erro ao conectar. Tente novamente.");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  function handleAdminPasswordConfirm() {
    if (adminPass === ADMIN_PASSWORD) {
      setAdminModalVisible(false);
      setAdminPass("");
      setAdminPassError("");
      router.push({ pathname: "/admin-setup", params: { adminPassword: adminPass } });
    } else {
      setAdminPassError("Senha incorreta");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  const bioLabel = bioType === "face" ? "Face ID" : bioType === "iris" ? "Íris" : "Touch ID";
  const bioIcon = bioType === "face" ? "smile" : "hexagon";
  const hasInput = email.trim().length > 0 || password.length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: topPad + 32, paddingBottom: bottomPad + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >


        {/* Header */}
        <View style={styles.header}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logoBox} resizeMode="contain" />
          ) : (
            <Image source={require("../../assets/images/icon.png")} style={styles.logoBox} resizeMode="contain" />
          )}
          <Text style={[styles.title, { color: colors.foreground }]}>{brandName}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Bem-vindo de volta! Entre para continuar.
          </Text>
        </View>

        {/* Biometric shortcut */}
        {bioAvailable && (
          <TouchableOpacity
            style={[styles.bioBtn, { backgroundColor: colors.card, borderColor: colors.primary + "30" }]}
            onPress={handleBiometricLogin}
            disabled={bioLoading}
            activeOpacity={0.8}
          >
            {bioLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <View style={[styles.bioIconWrap, { backgroundColor: colors.primary + "15" }]}>
                  <Feather name={bioIcon as any} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bioTitle, { color: colors.foreground }]}>
                    Entrar com {bioLabel}
                  </Text>
                  <Text style={[styles.bioDesc, { color: colors.mutedForeground }]}>
                    Acesso rápido e seguro
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </>
            )}
          </TouchableOpacity>
        )}

        {bioAvailable && (
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>ou continue com e-mail</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>
        )}

        {/* Form card */}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* E-mail */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>E-mail</Text>
            <View style={[
              styles.inputRow,
              {
                backgroundColor: colors.background,
                borderColor: error && !password ? colors.destructive : colors.border,
              },
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
              />
            </View>
          </View>

          {/* Senha */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.foreground }]}>Senha</Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")}>
                <Text style={[styles.forgotLink, { color: colors.primary }]}>Esqueci a senha</Text>
              </TouchableOpacity>
            </View>
            <View style={[
              styles.inputRow,
              {
                backgroundColor: colors.background,
                borderColor: error ? colors.destructive : colors.border,
              },
            ]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Sua senha"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(""); }}
                secureTextEntry={!showPass}
                textContentType="password"
                onSubmitEditing={handleLogin}
                returnKeyType="go"
              />
              <TouchableOpacity onPress={() => setShowPass((s) => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name={showPass ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {!!error && (
              <View style={styles.errorRow}>
                <Feather name="alert-circle" size={12} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            )}
          </View>

          {/* Login button */}
          <TouchableOpacity
            style={[
              styles.loginBtn,
              {
                backgroundColor: hasInput && !loading ? colors.primary : colors.muted,
                marginTop: 4,
              },
            ]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={[
                  styles.loginBtnText,
                  { color: hasInput ? colors.primaryForeground : colors.mutedForeground },
                ]}>
                  Entrar
                </Text>
                {hasInput && <Feather name="arrow-right" size={18} color={colors.primaryForeground} />}
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Criar conta — shown only when allow_signup=true */}
        {authConfig?.allow_signup && (
          <TouchableOpacity
            style={[styles.signupBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => router.push("/(auth)/register")}
            activeOpacity={0.8}
          >
            <Feather name="user-plus" size={16} color={colors.primary} />
            <Text style={[styles.signupBtnText, { color: colors.foreground }]}>
              Criar conta
            </Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        {!apiKey && (
          <View style={[styles.noApiKeyBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="alert-circle" size={14} color={colors.mutedForeground} />
            <Text style={[styles.noApiKeyText, { color: colors.mutedForeground }]}>
              App aguardando configuração do administrador
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Admin modal */}
      <Modal
        visible={adminModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAdminModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalIconBox, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="lock" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Área Restrita</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Digite a senha de administrador para continuar
            </Text>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: adminPassError ? colors.destructive : colors.border, marginTop: 16 }]}>
              <Feather name="key" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Senha de administrador"
                placeholderTextColor={colors.mutedForeground}
                value={adminPass}
                onChangeText={(t) => { setAdminPass(t); setAdminPassError(""); }}
                secureTextEntry={!showAdminPass}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleAdminPasswordConfirm}
                returnKeyType="go"
              />
              <TouchableOpacity onPress={() => setShowAdminPass((s) => !s)}>
                <Feather name={showAdminPass ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {!!adminPassError && (
              <Text style={[styles.errorText, { color: colors.destructive, marginTop: 4 }]}>{adminPassError}</Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => { setAdminModalVisible(false); setAdminPass(""); setAdminPassError(""); }}
              >
                <Text style={[styles.modalCancelText, { color: colors.foreground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleAdminPasswordConfirm}
              >
                <Text style={[styles.modalConfirmText, { color: colors.primaryForeground }]}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24 },
  lockBtn: { position: "absolute", right: 20, zIndex: 10 },
  lockBadge: {
    width: 38, height: 38, borderRadius: 11, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  configuredDot: {
    position: "absolute", top: 5, right: 5,
    width: 8, height: 8, borderRadius: 4,
  },
  header: { alignItems: "center", marginBottom: 28 },
  logoBox: { width: 84, height: 84, borderRadius: 22, marginBottom: 18 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  bioBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 4,
  },
  bioIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  bioTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  bioDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 18 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  formCard: {
    borderRadius: 20, borderWidth: 1,
    padding: 20, gap: 16,
    marginBottom: 16,
  },
  fieldGroup: { gap: 7 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  forgotLink: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  loginBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 14,
  },
  loginBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  signupBtn: {
    flexDirection: "row", alignItems: "center",
    gap: 10, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12,
  },
  signupBtnText: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  noApiKeyBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  noApiKeyText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%", maxWidth: 380, borderRadius: 20,
    borderWidth: 1, padding: 24, alignItems: "center",
  },
  modalIconBox: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 6 },
  modalSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 20, width: "100%" },
  modalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, alignItems: "center",
  },
  modalCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalConfirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  modalConfirmText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
