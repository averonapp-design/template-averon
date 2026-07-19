import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useNotifications } from "@/context/NotificationContext";

const NOTIF_PROMPT_KEY = "@averon_notif_prompt_shown";

export function NotificationPermissionModal() {
  const colors = useColors();
  const { permissionGranted, requestPermission } = useNotifications();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const [scaleAnim] = useState(new Animated.Value(0.9));
  const [opacityAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (Platform.OS === "web") return;

    async function checkPermissionPrompt() {
      try {
        const shown = await AsyncStorage.getItem(NOTIF_PROMPT_KEY);
        if (!shown && !permissionGranted) {
          // Delay popup slightly so user sees the home screen first
          const timer = setTimeout(() => {
            setVisible(true);
            Animated.parallel([
              Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
              }),
              Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
              }),
            ]).start();
          }, 1200);
          return () => clearTimeout(timer);
        }
      } catch {}
    }

    checkPermissionPrompt();
  }, [permissionGranted]);

  async function handleEnable() {
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await requestPermission();
      await AsyncStorage.setItem(NOTIF_PROMPT_KEY, "true");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      dismissModal();
    }
  }

  async function handleDismiss() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await AsyncStorage.setItem(NOTIF_PROMPT_KEY, "true").catch(() => {});
    dismissModal();
  }

  function dismissModal() {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  }

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Glowing Header Icon */}
          <View style={[styles.iconWrapper, { backgroundColor: colors.primary + "18" }]}>
            <View style={[styles.innerIconBox, { backgroundColor: colors.primary }]}>
              <Feather name="bell" size={28} color="#ffffff" />
            </View>
          </View>

          {/* Title & Description */}
          <Text style={[styles.title, { color: colors.foreground }]}>
            Não perca nenhuma novidade! 🔔
          </Text>

          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            Ative as notificações para receber avisos importantes, novos lançamentos e comunicados exclusivos.
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleEnable}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Feather name="bell" size={18} color="#ffffff" />
                  <Text style={styles.primaryButtonText}>Ativar Notificações</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={handleDismiss}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.mutedForeground }]}>
                Agora não
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  iconWrapper: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  innerIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonContainer: {
    width: "100%",
    gap: 10,
  },
  primaryButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 14,
    gap: 8,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  secondaryButton: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
