import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function SignupConfirmScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { apiKey, setSession } = useAuth();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const codeStr = code.join("");
  const isCodeFull = codeStr.length === CODE_LENGTH;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  function shake() {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }

  function handleChange(text: string, index: number) {
    const val = text.replace(/\D/g, "").slice(0, 1);
    const next = [...code];
    next[index] = val;
    setCode(next);
    setError("");
    if (val && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === "Backspace") {
      if (!code[index] && index > 0) {
        const next = [...code];
        next[index - 1] = "";
        setCode(next);
        inputRefs.current[index - 1]?.focus();
      }
    }
  }

  function handlePaste(text: string, index: number) {
    const digits = text.replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (digits.length > 1) {
      const next = Array(CODE_LENGTH).fill("");
      for (let i = 0; i < digits.length; i++) next[i] = digits[i];
      setCode(next);
      inputRefs.current[Math.min(digits.length, CODE_LENGTH - 1)]?.focus();
    } else {
      handleChange(text, index);
    }
  }

  async function handleSubmit() {
    if (!isCodeFull || loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await averonApi.signupConfirm(apiKey ?? "", email ?? "", codeStr);
      await setSession(res.access_token, res.aluno);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
      Animated.spring(successScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
      setTimeout(() => router.replace("/(tabs)"), 1600);
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("invalid_code")) {
        setError("Código inválido ou expirado. Verifique e tente novamente.");
      } else if (msg.includes("email_in_use")) {
        setError("Este e-mail já foi confirmado. Faça login.");
      } else if (msg === "network_error" || msg === "timeout") {
        setError("Sem conexão. Verifique sua rede.");
      } else {
        setError("Não foi possível confirmar. Tente novamente.");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    try {
      // We don't have the password anymore — just notify the user to go back
      setError("Para reenviar o código, volte e preencha o formulário novamente.");
    } finally {
      setResending(false);
    }
  }

  if (success) {
    return (
      <View style={[styles.fullCenter, { backgroundColor: colors.background }]}>
        <Animated.View style={{ transform: [{ scale: successScale }], marginBottom: 24 }}>
          <View style={[styles.successCircle, { backgroundColor: colors.success + "18" }]}>
            <Feather name="check" size={52} color={colors.success} />
          </View>
        </Animated.View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>Conta criada! 🎉</Text>
        <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
          Bem-vindo! Entrando no app…
        </Text>
      </View>
    );
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

        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="mail" size={30} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Verifique seu e-mail</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Enviamos um código de 6 dígitos para{"\n"}
            <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
              {email}
            </Text>
          </Text>
        </View>

        {/* OTP boxes */}
        <Animated.View style={[styles.codeRow, { transform: [{ translateX: shakeAnim }] }]}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputRefs.current[i] = r; }}
              style={[
                styles.codeInput,
                {
                  backgroundColor: colors.card,
                  borderColor: error ? colors.destructive : digit ? colors.primary : colors.border,
                  color: colors.foreground,
                  shadowColor: digit ? colors.primary : "transparent",
                  shadowOpacity: digit ? 0.2 : 0,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: digit ? 3 : 0,
                },
              ]}
              value={digit}
              onChangeText={(t) => handlePaste(t, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={CODE_LENGTH}
              textAlign="center"
              autoFocus={i === 0}
              selectTextOnFocus
            />
          ))}
        </Animated.View>

        {/* Error */}
        {!!error && (
          <View style={styles.errorRow}>
            <Feather name="alert-circle" size={13} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}

        {/* Resend */}
        <TouchableOpacity
          style={styles.resendRow}
          onPress={handleResend}
          disabled={resendCooldown > 0 || resending}
          activeOpacity={0.7}
        >
          {resending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : resendCooldown > 0 ? (
            <Text style={[styles.resendText, { color: colors.mutedForeground }]}>
              Reenviar em {resendCooldown}s
            </Text>
          ) : (
            <Text style={[styles.resendText, { color: colors.primary }]}>
              Não recebi o código — Reenviar
            </Text>
          )}
        </TouchableOpacity>

        {/* Confirm button */}
        <TouchableOpacity
          style={[
            styles.btn,
            { backgroundColor: isCodeFull && !loading ? colors.primary : colors.muted },
          ]}
          onPress={handleSubmit}
          disabled={!isCodeFull || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={[
                styles.btnText,
                { color: isCodeFull ? colors.primaryForeground : colors.mutedForeground },
              ]}>
                Confirmar e entrar
              </Text>
              {isCodeFull && <Feather name="check-circle" size={16} color={colors.primaryForeground} />}
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          O código expira em 15 minutos. Verifique sua caixa de spam se não encontrar.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24 },
  fullCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
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
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 10, textAlign: "center", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 23 },
  codeRow: { flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 16 },
  codeInput: {
    width: 46, height: 56, borderRadius: 12, borderWidth: 2,
    fontSize: 22, fontFamily: "Inter_700Bold",
  },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8, justifyContent: "center" },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", flex: 1 },
  resendRow: { alignItems: "center", marginBottom: 24, paddingVertical: 4 },
  resendText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 14, marginBottom: 16,
  },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  successCircle: {
    width: 110, height: 110, borderRadius: 55,
    alignItems: "center", justifyContent: "center",
  },
  successTitle: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 12, letterSpacing: -0.5 },
  successSub: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 23 },
});
