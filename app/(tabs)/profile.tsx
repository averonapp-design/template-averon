import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { averonApi } from "@/services/averon";

export default function ProfileScreen() {
  const colors = useColors();
  const { isDark, setColorSchemeOverride } = useTheme();
  const insets = useSafeAreaInsets();
  const { aluno, apiKey, logout, deleteAccount, updateProfile, uploadAvatar } = useAuth();

  // Fire daily_login event once per session when profile tab is visited
  const firedThisSession = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (firedThisSession.current || !apiKey || !aluno?.id) return;
      firedThisSession.current = true;
      averonApi.postEvento(apiKey, aluno.id, "daily_login").catch(() => {});
    }, [apiKey, aluno?.id])
  );

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(aluno?.nome ?? "");
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 90 : insets.bottom + 90;

  const initials = aluno?.nome
    ? aluno.nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
    : "?";

  async function handleLogout() {
    await logout();
    router.replace("/(auth)/login");
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      setShowDeleteModal(false);
      router.replace("/(auth)/login");
    } catch (e: any) {
      setDeleteError(e?.message ?? "Não foi possível excluir a conta. Tente novamente ou entre em contato com o suporte.");
    } finally {
      setDeletingAccount(false);
    }
  }

  async function handlePickAvatar() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permissão necessária", "Permita o acesso à galeria nas configurações.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];

    setUploadingAvatar(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      await uploadAvatar(manipulated.uri, "image/jpeg");
    } catch (e: any) {
      const msg = e?.message ?? "Não foi possível enviar a foto.";
      Alert.alert("Erro ao enviar foto", msg);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === aluno?.nome) { setEditingName(false); return; }
    setSavingName(true);
    try {
      await updateProfile({ nome: trimmed });
      setEditingName(false);
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Não foi possível salvar o nome.");
    } finally {
      setSavingName(false);
    }
  }

  interface MenuItem {
    id: string; icon: string; label: string; route?: string; action?: () => void;
  }

  const MENU_ITEMS: MenuItem[] = [
    { id: "notifications", icon: "bell", label: "Notificações", route: "/notifications" },
    ...(aluno?.is_admin ? [{ id: "settings", icon: "settings", label: "Configurações", route: "/settings" }] : []),
    { id: "support", icon: "help-circle", label: "Suporte", route: "/support" },
    {
      id: "change-password",
      icon: "key",
      label: "Trocar senha",
      action: () => router.push({ pathname: "/(auth)/forgot-password", params: { email: aluno?.email ?? "" } }),
    },
  ];

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Perfil</Text>
        </View>

        {/* Avatar + info */}
        <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.avatarWrap} onPress={handlePickAvatar} disabled={uploadingAvatar}>
            {aluno?.avatar_url ? (
              <Image source={{ uri: aluno.avatar_url }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={[styles.avatarEditBtn, { backgroundColor: colors.primary }]}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="camera" size={12} color="#fff" />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.userInfo}>
            {editingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={[styles.nameInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                />
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSaveName}
                  disabled={savingName}
                >
                  {savingName ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Feather name="check" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => { setEditingName(false); setNameInput(aluno?.nome ?? ""); }}
                >
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.nameRow}
                onPress={() => { setNameInput(aluno?.nome ?? ""); setEditingName(true); }}
              >
                <Text style={[styles.userName, { color: colors.foreground }]}>
                  {aluno?.nome ?? "Usuário"}
                </Text>
                <Feather name="edit-2" size={13} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
            <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>
              {aluno?.email ?? "—"}
            </Text>
            {aluno?.is_admin && (
              <View style={[styles.adminBadge, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="shield" size={12} color={colors.primary} />
                <Text style={[styles.adminBadgeText, { color: colors.primary }]}>Administrador</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>
          Toque na foto para trocar
        </Text>

        {/* Menu */}
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                index < MENU_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (item.route) router.push(item.route as any);
                else if (item.action) item.action();
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.accent ?? colors.muted }]}>
                <Feather name={item.icon as any} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Aparência */}
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: colors.accent ?? colors.muted }]}>
              <Feather name={isDark ? "moon" : "sun"} size={16} color={colors.primary} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.foreground }]}>Tema escuro</Text>
            <Switch
              value={isDark}
              onValueChange={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setColorSchemeOverride(isDark ? "light" : "dark");
              }}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Sair */}
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowLogoutModal(true)}>
            <View style={[styles.menuIcon, { backgroundColor: colors.destructive + "15" }]}>
              <Feather name="log-out" size={16} color={colors.destructive} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.destructive }]}>Sair</Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Excluir conta */}
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setDeleteError(null);
              setShowDeleteModal(true);
            }}
            disabled={deletingAccount}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.destructive + "15" }]}>
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.destructive }]}>Excluir conta</Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>Averon v1.0.0</Text>
      </ScrollView>

      {/* Modal de confirmação de logout */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowLogoutModal(false)}>
          <Pressable style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
            <View style={[styles.modalIconWrap, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="log-out" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Sair da conta</Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              Deseja sair da sua conta?
            </Text>
            <TouchableOpacity
              style={[styles.modalBtnDestroy, { backgroundColor: colors.primary }]}
              onPress={handleLogout}
            >
              <Text style={styles.modalBtnDestroyText}>Sair</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtnCancel, { borderColor: colors.border }]}
              onPress={() => setShowLogoutModal(false)}
            >
              <Text style={[styles.modalBtnCancelText, { color: colors.foreground }]}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!deletingAccount) setShowDeleteModal(false); }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { if (!deletingAccount) setShowDeleteModal(false); }}
        >
          <Pressable style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
            <View style={[styles.modalIconWrap, { backgroundColor: colors.destructive + "15" }]}>
              <Feather name="alert-triangle" size={28} color={colors.destructive} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Excluir conta</Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              Esta ação é permanente e irreversível. Todos os seus dados, progresso e histórico serão apagados.
            </Text>
            <Text style={[styles.modalEmail, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}>
              {aluno?.email ?? ""}
            </Text>

            {deleteError && (
              <Text style={[styles.modalError, { color: colors.destructive }]}>{deleteError}</Text>
            )}

            <TouchableOpacity
              style={[styles.modalBtnDestroy, { backgroundColor: colors.destructive }]}
              onPress={handleDeleteAccount}
              disabled={deletingAccount}
            >
              {deletingAccount ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalBtnDestroyText}>Sim, excluir minha conta</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtnCancel, { borderColor: colors.border }]}
              onPress={() => setShowDeleteModal(false)}
              disabled={deletingAccount}
            >
              <Text style={[styles.modalBtnCancelText, { color: colors.foreground }]}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  userCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 14,
    margin: 16, marginBottom: 4, padding: 16, borderRadius: 16, borderWidth: 1,
  },
  avatarWrap: { position: "relative" },
  avatarImg: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  avatarEditBtn: {
    position: "absolute", bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  avatarHint: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 14 },
  userInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 18, fontFamily: "Inter_700Bold" },
  nameEditRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  nameInput: {
    flex: 1, fontSize: 16, fontFamily: "Inter_500Medium",
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  saveBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cancelBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  userEmail: { fontSize: 14, fontFamily: "Inter_400Regular" },
  adminBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, marginTop: 2,
  },
  adminBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  menuCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  version: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", padding: 16 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  modalIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  modalBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  modalEmail: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1,
    alignSelf: "stretch", textAlign: "center",
  },
  modalError: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  modalBtnDestroy: {
    alignSelf: "stretch", paddingVertical: 14, borderRadius: 12,
    alignItems: "center", marginTop: 4,
  },
  modalBtnDestroyText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalBtnCancel: {
    alignSelf: "stretch", paddingVertical: 13, borderRadius: 12,
    alignItems: "center", borderWidth: 1,
  },
  modalBtnCancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
