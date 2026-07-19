import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Tabs, router } from "expo-router";
import React, { useEffect } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useApplePay } from "@/hooks/useApplePay";
import { useTheme } from '@/context/ThemeContext';
import { DebugButton } from '@/components/DebugButton';

type TabConf = { name: string; icon: string; label: string; href: string };

const BASE_TABS: TabConf[] = [
  { name: "index",        icon: "home",        label: "Início",     href: "/(tabs)/"             },
  { name: "comunidade",   icon: "users",       label: "Comunidade", href: "/(tabs)/comunidade"   },
  { name: "achievements", icon: "award",       label: "Conquistas", href: "/(tabs)/achievements" },
  { name: "profile",      icon: "user",        label: "Perfil",     href: "/(tabs)/profile"      },
];

const APPLE_PAY_TAB: TabConf = {
  name: "apple-pay",
  icon: "shopping-bag",
  label: "Comprar",
  href: "/(tabs)/apple-pay",
};

function CustomTabBar({ state }: any) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const bottomInset = isWeb ? 0 : insets.bottom;

  // Dynamic Apple Pay tab — only when API says enabled=true
  const { apiKey, alunoToken } = useAuth();
  const { tema } = useTheme();
  const { enabled } = useApplePay(apiKey, alunoToken);

  const comunidadeEnabled = tema?.comunidade_ativa !== false;
  const gamificacaoEnabled = tema?.gamificacao_ativa !== false;
  const perfilEnabled = tema?.perfil_ativo !== false;

  const visibleTabs = [
    ...BASE_TABS.filter((t) => {
      if (t.name === "comunidade" && !comunidadeEnabled) return false;
      if (t.name === "achievements" && !gamificacaoEnabled) return false;
      if (t.name === "profile" && !perfilEnabled) return false;
      return true;
    }),
    ...(enabled ? [APPLE_PAY_TAB] : []),
  ];

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingBottom: bottomInset },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        ]}
      >
        {(state.routes as any[])
          .filter((route) => visibleTabs.some((t) => t.name === route.name))
          .map((route) => {
            const focused = state.routes[state.index]?.name === route.name;
            const conf = visibleTabs.find((t) => t.name === route.name);
            if (!conf) return null;

            return (
              <TouchableOpacity
                key={route.key}
                style={styles.item}
                onPress={() => {
                  if (focused) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.navigate(conf.href as any);
                }}
                activeOpacity={0.7}
              >
                {focused && <View style={[styles.activePill, { backgroundColor: colors.primary + "1A" }]} />}
                <Feather
                  name={conf.icon as any}
                  size={22}
                  color={focused ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.label,
                    { color: focused ? colors.primary : colors.mutedForeground },
                    focused && styles.labelFocused,
                  ]}
                  numberOfLines={1}
                >
                  {conf.label}
                </Text>
              </TouchableOpacity>
            );
          })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: 12,
    position: "relative",
  },
  activePill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  labelFocused: {
    fontFamily: "Inter_600SemiBold",
  },
});

export default function TabLayout() {
  const { isAuthenticated, isLoading, authConfig } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    const requireLogin = authConfig === null || authConfig.require_login !== false;
    if (!isAuthenticated && requireLogin) {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, isLoading, authConfig]);

  return (
    <>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="courses" />
        <Tabs.Screen name="comunidade" />
        <Tabs.Screen name="achievements" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="apple-pay" />
      </Tabs>
      <DebugButton />
    </>
  );
}
