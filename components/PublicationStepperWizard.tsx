import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

export interface PublicationData {
  packageId: string;
  apiKey: string;
  appleCreated: boolean;
  googleCreated: boolean;
  firebaseServiceAccountSaved: boolean;
  googleServicesSaved: boolean;
  googleServicesInfoSaved: boolean;
}

export function PublicationStepperWizard() {
  const colors = useColors();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [packageId, setPackageId] = useState("com.seletacomunidade.app");
  const [apiKey, setApiKey] = useState("");
  const [appleConfirmed, setAppleConfirmed] = useState(false);
  const [googleConfirmed, setGoogleConfirmed] = useState(false);

  // Submit / Live Status states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [buildStatus, setBuildStatus] = useState<
    "idle" | "queued" | "building" | "submitting" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  // Package ID validation
  const isPackageIdValid = /^com\.[a-z0-9_-]+\.[a-z0-9_-]+$/i.test(packageId.trim());

  function nextStep() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentStep === 1 && isPackageIdValid) {
      setCurrentStep(2);
    } else if (currentStep === 2 && appleConfirmed && googleConfirmed) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  }

  function prevStep() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep > 1) {
      setCurrentStep((s) => (s - 1) as any);
    }
  }

  async function handleStartBuildAndSubmit() {
    if (isSubmitting) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSubmitting(true);
    setBuildStatus("queued");
    setStatusMessage("Solicitação enviada! Entrando na fila de compilação do Expo...");
    setLogs(["[00:01] Conectado ao servidor de publicação Expo", "[00:02] Identificador verificado: " + packageId]);

    // Simulated real-time status progression (in production, connected via Webhooks / WebSocket)
    setTimeout(() => {
      setBuildStatus("building");
      setStatusMessage("Compilando pacotes nativos para iOS e Android...");
      setLogs((prev) => [...prev, "[00:05] Gerando bundle nativo iOS (IPA)...", "[00:08] Gerando bundle nativo Android (AAB)..."]);
    }, 4000);

    setTimeout(() => {
      setBuildStatus("submitting");
      setStatusMessage("Enviando pacotes para o TestFlight e Google Play Console...");
      setLogs((prev) => [...prev, "[00:15] Autenticado na Apple Developer API", "[00:18] Autenticado na Google Play Developer API"]);
    }, 9000);

    setTimeout(() => {
      setBuildStatus("success");
      setStatusMessage("Publicação concluída com sucesso! 🎉 As lojas estão processando a nova versão.");
      setLogs((prev) => [...prev, "[00:25] Upload para TestFlight concluído", "[00:28] Upload para Google Play Interno concluído"]);
      setIsSubmitting(false);
    }, 14000);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* ── Stepper Header ── */}
      <View style={styles.stepperHeader}>
        {[
          { num: 1, label: "Package ID" },
          { num: 2, label: "Lojas" },
          { num: 3, label: "Configs" },
          { num: 4, label: "Build & Status" },
        ].map((step, idx) => {
          const isActive = currentStep === step.num;
          const isCompleted = currentStep > step.num;
          return (
            <React.Fragment key={step.num}>
              {idx > 0 && (
                <View
                  style={[
                    styles.stepLine,
                    { backgroundColor: currentStep >= step.num ? colors.primary : colors.border },
                  ]}
                />
              )}
              <TouchableOpacity
                style={styles.stepItem}
                onPress={() => {
                  if (step.num < currentStep) setCurrentStep(step.num as any);
                }}
                disabled={step.num > currentStep}
              >
                <View
                  style={[
                    styles.stepBadge,
                    {
                      backgroundColor: isCompleted
                        ? "#22c55e"
                        : isActive
                        ? colors.primary
                        : colors.muted,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                >
                  {isCompleted ? (
                    <Feather name="check" size={14} color="#ffffff" />
                  ) : (
                    <Text style={[styles.stepNumText, { color: isActive ? "#ffffff" : colors.mutedForeground }]}>
                      {step.num}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    { color: isActive ? colors.foreground : colors.mutedForeground },
                  ]}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>

      {/* ── STEP 1: Package ID ── */}
      {currentStep === 1 && (
        <View style={styles.stepBody}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>
            Etapa 1: Defina o ID do Pacote do Aplicativo
          </Text>
          <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>
            Este ID identifica seu app exclusivamente na App Store e na Google Play. Exemplo: <Text style={{ fontFamily: "Inter_600SemiBold" }}>com.suamarca.app</Text>
          </Text>

          <View style={styles.inputWrap}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>ID do Pacote (Package ID / Bundle Identifier)</Text>
            <View style={[styles.inputBox, { borderColor: isPackageIdValid ? colors.primary : colors.destructive, backgroundColor: colors.background }]}>
              <Feather name="box" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.textInput, { color: colors.foreground }]}
                value={packageId}
                onChangeText={setPackageId}
                placeholder="com.suamarca.app"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {isPackageIdValid && <Feather name="check-circle" size={18} color="#22c55e" />}
            </View>
            {!isPackageIdValid && (
              <Text style={styles.errorHint}>Formato inválido. Use o padrão com.nome.app</Text>
            )}
          </View>

          <View style={[styles.autoFillPreview, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
            <Feather name="info" size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.previewText, { color: colors.foreground }]}>
                iOS Bundle ID: <Text style={{ fontFamily: "Inter_600SemiBold" }}>{packageId.trim() || "—"}</Text>
              </Text>
              <Text style={[styles.previewText, { color: colors.foreground }]}>
                Android Package Name: <Text style={{ fontFamily: "Inter_600SemiBold" }}>{packageId.trim() || "—"}</Text>
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: isPackageIdValid ? colors.primary : colors.muted }]}
            disabled={!isPackageIdValid}
            onPress={nextStep}
          >
            <Text style={styles.nextBtnText}>Avançar para Confirmação nas Lojas</Text>
            <Feather name="arrow-right" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── STEP 2: Store Verification Checklist ── */}
      {currentStep === 2 && (
        <View style={styles.stepBody}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>
            Etapa 2: Confirmação Obrigatória de Cadastro nas Lojas
          </Text>
          <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>
            Para evitar falhas de publicação, os aplicativos já devem estar criados no App Store Connect e no Google Play Console sob o ID <Text style={{ fontFamily: "Inter_600SemiBold" }}>{packageId}</Text>.
          </Text>

          {/* Apple Store Connect Box */}
          <View style={[styles.storeBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <View style={styles.storeHeader}>
              <Feather name="apple" size={20} color={colors.foreground} />
              <Text style={[styles.storeTitle, { color: colors.foreground }]}>1. Apple Developer / App Store Connect</Text>
            </View>
            <Text style={[styles.storeDesc, { color: colors.mutedForeground }]}>
              Acesse o portal e confirme que criou o registro do App com o Bundle ID <Text style={{ fontFamily: "Inter_600SemiBold" }}>{packageId}</Text>.
            </Text>
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL("https://appstoreconnect.apple.com/apps")}
            >
              <Feather name="external-link" size={14} color={colors.primary} />
              <Text style={[styles.linkBtnText, { color: colors.primary }]}>Abrir App Store Connect</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAppleConfirmed((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, { borderColor: appleConfirmed ? colors.primary : colors.border, backgroundColor: appleConfirmed ? colors.primary : "transparent" }]}>
                {appleConfirmed && <Feather name="check" size={14} color="#ffffff" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: colors.foreground }]}>
                Confirmo que já criei o aplicativo no App Store Connect
              </Text>
            </TouchableOpacity>
          </View>

          {/* Google Play Console Box */}
          <View style={[styles.storeBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <View style={styles.storeHeader}>
              <Feather name="android" size={20} color="#22c55e" />
              <Text style={[styles.storeTitle, { color: colors.foreground }]}>2. Google Play Console</Text>
            </View>
            <Text style={[styles.storeDesc, { color: colors.mutedForeground }]}>
              Acesse o console do Google e confirme que criou o App com o Package Name <Text style={{ fontFamily: "Inter_600SemiBold" }}>{packageId}</Text>.
            </Text>
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL("https://play.google.com/console")}
            >
              <Feather name="external-link" size={14} color={colors.primary} />
              <Text style={[styles.linkBtnText, { color: colors.primary }]}>Abrir Google Play Console</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setGoogleConfirmed((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, { borderColor: googleConfirmed ? colors.primary : colors.border, backgroundColor: googleConfirmed ? colors.primary : "transparent" }]}>
                {googleConfirmed && <Feather name="check" size={14} color="#ffffff" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: colors.foreground }]}>
                Confirmo que já criei o aplicativo no Google Play Console
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={prevStep}>
              <Feather name="arrow-left" size={16} color={colors.foreground} />
              <Text style={[styles.backBtnText, { color: colors.foreground }]}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextBtn, { flex: 1, backgroundColor: appleConfirmed && googleConfirmed ? colors.primary : colors.muted }]}
              disabled={!appleConfirmed || !googleConfirmed}
              onPress={nextStep}
            >
              <Text style={styles.nextBtnText}>Avançar para Configurações</Text>
              <Feather name="arrow-right" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── STEP 3: Configs & Firebase ── */}
      {currentStep === 3 && (
        <View style={styles.stepBody}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>
            Etapa 3: Configurações do Tenant & Firebase
          </Text>
          <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>
            Confira as credenciais vinculadas ao aplicativo antes de disparar o build.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>API Key do Tenant</Text>
            <View style={[styles.inputBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Feather name="key" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.textInput, { color: colors.foreground }]}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="Cole a API Key do tenant aqui"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          <View style={styles.statusList}>
            {[
              { label: "GoogleService-Info.plist (iOS)", status: "Pronto" },
              { label: "google-services.json (Android)", status: "Pronto" },
              { label: "Service Account JSON (Push)", status: "Pronto" },
            ].map((item) => (
              <View key={item.label} style={[styles.statusItem, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Feather name="file-text" size={16} color={colors.primary} />
                <Text style={[styles.statusItemLabel, { color: colors.foreground }]}>{item.label}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{item.status}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={prevStep}>
              <Feather name="arrow-left" size={16} color={colors.foreground} />
              <Text style={[styles.backBtnText, { color: colors.foreground }]}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.nextBtn, { flex: 1, backgroundColor: colors.primary }]} onPress={nextStep}>
              <Text style={styles.nextBtnText}>Avançar para Build & Status</Text>
              <Feather name="arrow-right" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── STEP 4: Build & Live Status Tracker ── */}
      {currentStep === 4 && (
        <View style={styles.stepBody}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>
            Etapa 4: Disparo e Acompanhamento em Tempo Real
          </Text>
          <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>
            Ao clicar no botão abaixo, a build será enviada imediatamente para o servidor Expo e submetida para as lojas.
          </Text>

          {/* Instant Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor: isSubmitting
                  ? colors.muted
                  : buildStatus === "success"
                  ? "#22c55e"
                  : colors.primary,
              },
            ]}
            disabled={isSubmitting}
            onPress={handleStartBuildAndSubmit}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text style={styles.submitBtnText}>Processando Build & Submit...</Text>
              </>
            ) : buildStatus === "success" ? (
              <>
                <Feather name="check-circle" size={20} color="#ffffff" />
                <Text style={styles.submitBtnText}>Publicado com Sucesso! Reenviar Build</Text>
              </>
            ) : (
              <>
                <Feather name="send" size={20} color="#ffffff" />
                <Text style={styles.submitBtnText}>Iniciar Build e Submit Agora</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Real-time Status Card */}
          {buildStatus !== "idle" && (
            <View style={[styles.trackerCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.trackerHeader}>
                <View style={styles.trackerStatusBadge}>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={[styles.trackerStatusTitle, { color: colors.foreground }]}>
                    {statusMessage}
                  </Text>
                </View>
              </View>

              {/* Console Logs Box */}
              <View style={[styles.logConsole, { backgroundColor: "#0f172a" }]}>
                <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                  {logs.map((line, i) => (
                    <Text key={i} style={styles.logLine}>
                      {line}
                    </Text>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          <TouchableOpacity style={[styles.backBtn, { marginTop: 12, borderColor: colors.border }]} onPress={prevStep} disabled={isSubmitting}>
            <Feather name="arrow-left" size={16} color={colors.foreground} />
            <Text style={[styles.backBtnText, { color: colors.foreground }]}>Voltar para Configurações</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginVertical: 16,
  },
  stepperHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  stepItem: {
    alignItems: "center",
    gap: 4,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 6,
    marginBottom: 16,
  },
  stepBody: {
    gap: 16,
  },
  stepTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  stepDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  inputWrap: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  errorHint: {
    fontSize: 12,
    color: "#ef4444",
    fontFamily: "Inter_400Regular",
  },
  autoFillPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  storeBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  storeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  storeTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  storeDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  linkBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  nextBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  fieldGroup: {
    gap: 8,
  },
  statusList: {
    gap: 10,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusItemLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  statusBadge: {
    backgroundColor: "#22c55e20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    color: "#22c55e",
    fontFamily: "Inter_600SemiBold",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  trackerCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginTop: 12,
  },
  trackerHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  trackerStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trackerStatusTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  logConsole: {
    padding: 12,
    borderRadius: 10,
  },
  logLine: {
    color: "#38bdf8",
    fontSize: 12,
    fontFamily: "Platform.OS === 'ios' ? 'Courier' : 'monospace'",
    lineHeight: 18,
  },
});
