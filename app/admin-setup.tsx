import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
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

export default function AdminSetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { apiKey, saveApiKey } = useAuth();
  const params = useLocalSearchParams<{ adminPassword?: string }>();

  const adminPassword = params.adminPassword ?? "";

  const [inputKey, setInputKey] = useState(apiKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const isConfigured = !!apiKey;

  async function handleSave() {
    const key = inputKey.trim();
    if (!key) { setError("Informe a API Key"); return; }
    if (!adminPassword) { setError("Senha de admin inválida. Volte e tente novamente."); return; }
    setError("");
    setLoading(true);
    try {
      await saveApiKey(key, adminPassword);
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.back(), 1500);
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg === "invalid_password") {
        setError("Senha de administrador inválida.");
      } else if (msg === "api_key_required") {
        setError("A API Key não pode estar vazia.");
      } else {
        setError("Erro ao salvar. Verifique sua conexão e tente novamente.");
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
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={[styles.iconBox, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="settings" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Configurações de Admin
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            A API Key é configurada uma vez no servidor e funciona para todos os usuários do app automaticamente.
          </Text>
        </View>

        {isConfigured && !success && (
          <View style={[styles.statusBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
            <Feather name="check-circle" size={16} color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.primary }]}>
              API Key configurada e ativa no servidor
            </Text>
          </View>
        )}

        {success && (
          <View style={[styles.statusBanner, { backgroundColor: "#22c55e20", borderColor: "#22c55e40" }]}>
            <Feather name="check-circle" size={16} color="#22c55e" />
            <Text style={[styles.statusText, { color: "#22c55e" }]}>
              API Key salva no servidor com sucesso!
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            API Key do Tenant
          </Text>
          <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
            Encontre sua API Key no painel web da Averon → Configurações → Integrações.
          </Text>

          <View style={styles.fieldGroup}>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: colors.card,
                  borderColor: error ? colors.destructive : colors.border,
                },
              ]}
            >
              <Feather name="key" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Cole sua API Key aqui"
                placeholderTextColor={colors.mutedForeground}
                value={inputKey}
                onChangeText={(t) => { setInputKey(t); setError(""); setSuccess(false); }}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowKey((s) => !s)}>
                <Feather
                  name={showKey ? "eye-off" : "eye"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>
            {!!error && (
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.saveBtn,
              {
                backgroundColor: success ? "#22c55e" : colors.primary,
                opacity: loading ? 0.75 : 1,
              },
            ]}
            onPress={handleSave}
            disabled={loading || success}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : success ? (
              <>
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Salvo no servidor!</Text>
              </>
            ) : (
              <>
                <Feather name="upload-cloud" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>
                  {isConfigured ? "Atualizar API Key" : "Salvar API Key"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Feather name="globe" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              A API Key é salva no servidor do app — todos os usuários em qualquer dispositivo a recebem automaticamente ao abrir o app.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="shield" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Alunos fazem login com e-mail e senha. Apenas admins podem alterar esta configuração.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Ao trocar a API Key, todos os usuários passarão a usar a nova chave automaticamente na próxima abertura do app.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: { marginBottom: 24, alignSelf: "flex-start" },
  header: { alignItems: "center", marginBottom: 28 },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 8, textAlign: "center" },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  statusText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  section: { gap: 12, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sectionDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  fieldGroup: { gap: 6 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  infoCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  infoRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
