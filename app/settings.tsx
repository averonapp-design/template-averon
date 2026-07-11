import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";

export default function SettingsScreen() {
  const colors = useColors();
  const { isDark, colorSchemeOverride, setColorSchemeOverride } = useTheme();
  const insets = useSafeAreaInsets();

  const [notifPush, setNotifPush] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [biometria, setBiometria] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  function handleToggle(setter: (v: boolean) => void, value: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setter(!value);
  }

  function handleDarkToggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setColorSchemeOverride(isDark ? "light" : "dark");
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
        <Text style={[styles.title, { color: colors.foreground }]}>Configurações</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Notificações */}
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>
          Notificações
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
              <Feather name="bell" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>
              Notificações push
            </Text>
            <Switch
              value={notifPush}
              onValueChange={() => handleToggle(setNotifPush, notifPush)}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
              <Feather name="mail" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>
              E-mail de alertas
            </Text>
            <Switch
              value={notifEmail}
              onValueChange={() => handleToggle(setNotifEmail, notifEmail)}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Segurança */}
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>
          Segurança
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {Platform.OS !== "web" && (
            <View style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
                <Feather name="shield" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>
                  Biometria
                </Text>
                <Text style={[styles.settingDesc, { color: colors.mutedForeground }]}>
                  Face ID / Touch ID
                </Text>
              </View>
              <Switch
                value={biometria}
                onValueChange={() => handleToggle(setBiometria, biometria)}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#fff"
              />
            </View>
          )}
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push("/(auth)/otp")}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
              <Feather name="lock" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>
              Verificação em duas etapas
            </Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Aparência */}
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>
          Aparência
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
              <Feather name={isDark ? "moon" : "sun"} size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>
                Tema escuro
              </Text>
              <Text style={[styles.settingDesc, { color: colors.mutedForeground }]}>
                {colorSchemeOverride === "system"
                  ? "Seguindo o sistema"
                  : isDark
                  ? "Modo escuro ativo"
                  : "Modo claro ativo"}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={handleDarkToggle}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Legal */}
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>
          Legal
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: "Política de privacidade", icon: "shield" },
            { label: "Termos de uso", icon: "file-text" },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.settingRow,
                i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
                <Feather name={item.icon as any} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>
                {item.label}
              </Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
  content: { padding: 20, gap: 8 },
  groupLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 4,
  },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 4 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  settingDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
});
