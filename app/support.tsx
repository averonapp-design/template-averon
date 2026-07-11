import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  RefreshControl,
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
import { averonApi, SuporteConfig, Ticket, TicketMensagem } from "@/services/averon";

type ScreenView = "main" | "new-ticket" | "success" | "detail";

export default function SupportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { apiKey, alunoToken } = useAuth();

  const [config, setConfig] = useState<SuporteConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [view, setView] = useState<ScreenView>("main");
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function fetchTickets() {
    if (!apiKey || !alunoToken) return;
    setTicketsLoading(true);
    try {
      const res = await averonApi.getTickets(apiKey, alunoToken);
      setTickets(res.data ?? res.tickets ?? []);
    } catch {}
    finally { setTicketsLoading(false); }
  }

  // Load config + tickets in parallel
  useEffect(() => {
    if (!apiKey) { setLoadingConfig(false); return; }
    averonApi
      .getSuporteConfig(apiKey)
      .then((res) => setConfig(res.config ?? null))
      .catch(() => setConfig(null))
      .finally(() => setLoadingConfig(false));

    if (alunoToken) fetchTickets();
  }, [apiKey, alunoToken]);

  function openWhatsApp() {
    const num = (config?.whatsapp_number ?? "").replace(/\D/g, "");
    if (!num) return;
    Linking.openURL(`https://wa.me/${num}`).catch(() =>
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp.")
    );
  }

  function openEmail() {
    const email = config?.email_address ?? "";
    if (!email) return;
    Linking.openURL(`mailto:${email}`).catch(() =>
      Alert.alert("Erro", "Não foi possível abrir o e-mail.")
    );
  }

  function goBack() {
    if (view === "new-ticket") {
      setView("main");
    } else if (view === "success") {
      setView("main");
      setCreatedTicketId(null);
      fetchTickets();
    } else if (view === "detail") {
      setActiveTicket(null);
      setView("main");
      fetchTickets();
    } else {
      router.back();
    }
  }

  function onTicketCreated(ticketId: string) {
    setCreatedTicketId(ticketId);
    setView("success");
    fetchTickets();
  }

  function openTicketDetail(ticket: Ticket) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTicket(ticket);
    setView("detail");
  }

  const headerTitle =
    view === "new-ticket" ? "Novo Chamado" :
    view === "detail" ? (activeTicket?.assunto ?? "Chamado") :
    "Suporte";

  if (loadingConfig) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Suporte</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  const channel = config?.preferred_channel ?? "ticket";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {view === "success" ? "Chamado Aberto" : headerTitle}
        </Text>
        {view === "main" && channel === "ticket" ? (
          <TouchableOpacity
            style={styles.newTicketBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setView("new-ticket"); }}
          >
            <Feather name="plus" size={22} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {/* Content */}
      {view === "success" ? (
        <SuccessView
          ticketId={createdTicketId}
          colors={colors}
          bottomPad={bottomPad}
          onBack={() => { setView("main"); setCreatedTicketId(null); }}
        />
      ) : view === "detail" && activeTicket ? (
        <TicketDetailView
          ticket={activeTicket}
          apiKey={apiKey ?? ""}
          alunoToken={alunoToken ?? ""}
          colors={colors}
          bottomPad={bottomPad}
        />
      ) : view === "new-ticket" ? (
        <NewTicketView
          apiKey={apiKey ?? ""}
          alunoToken={alunoToken ?? ""}
          colors={colors}
          bottomPad={bottomPad}
          onCreated={onTicketCreated}
        />
      ) : channel === "whatsapp" ? (
        <WhatsAppView
          config={config}
          colors={colors}
          bottomPad={bottomPad}
          onOpen={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openWhatsApp(); }}
        />
      ) : channel === "email" ? (
        <EmailView
          config={config}
          colors={colors}
          bottomPad={bottomPad}
          onOpen={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openEmail(); }}
        />
      ) : (
        <TicketMainView
          config={config}
          tickets={tickets}
          loading={ticketsLoading}
          colors={colors}
          bottomPad={bottomPad}
          onNewTicket={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setView("new-ticket"); }}
          onTicketPress={openTicketDetail}
          onRefresh={fetchTickets}
        />
      )}
    </View>
  );
}

// ── Success view ──────────────────────────────────────────────
function SuccessView({
  ticketId,
  colors,
  bottomPad,
  onBack,
}: {
  ticketId: string | null;
  colors: any;
  bottomPad: number;
  onBack: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]}>
      <View style={[styles.successCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.successIconWrap, { backgroundColor: "#10B981" + "18" }]}>
          <Feather name="check-circle" size={44} color="#10B981" />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>
          Chamado enviado com sucesso!
        </Text>
        <Text style={[styles.successDesc, { color: colors.mutedForeground }]}>
          Nossa equipe recebeu sua mensagem e vai entrar em contato em breve.
        </Text>
        {ticketId ? (
          <View style={[styles.ticketIdRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="hash" size={13} color={colors.mutedForeground} />
            <Text style={[styles.ticketIdText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {ticketId}
            </Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.channelCTA, { backgroundColor: colors.primary }]}
        onPress={onBack}
        activeOpacity={0.85}
      >
        <Feather name="arrow-left" size={18} color="#fff" />
        <Text style={styles.channelCTAText}>Voltar ao suporte</Text>
      </TouchableOpacity>

      <FaqSection colors={colors} />
    </ScrollView>
  );
}

// ── WhatsApp channel view ─────────────────────────────────────
function WhatsAppView({
  config,
  colors,
  bottomPad,
  onOpen,
}: {
  config: SuporteConfig | null;
  colors: any;
  bottomPad: number;
  onOpen: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]}>
      {config?.mensagem_boas_vindas ? (
        <WelcomeBanner text={config.mensagem_boas_vindas} colors={colors} />
      ) : null}

      <View style={[styles.channelHero, { backgroundColor: "#25D366" + "12", borderColor: "#25D366" + "35" }]}>
        <View style={[styles.channelHeroIcon, { backgroundColor: "#25D366" }]}>
          <Feather name="message-circle" size={36} color="#fff" />
        </View>
        <Text style={[styles.channelHeroTitle, { color: colors.foreground }]}>
          Suporte via WhatsApp
        </Text>
        <Text style={[styles.channelHeroDesc, { color: colors.mutedForeground }]}>
          Fale diretamente com nossa equipe pelo WhatsApp. Respondemos o mais rápido possível.
        </Text>
        {config?.whatsapp_number ? (
          <Text style={[styles.channelContact, { color: "#25D366" }]}>
            {config.whatsapp_number}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.channelCTA, { backgroundColor: "#25D366" }]}
        onPress={onOpen}
        activeOpacity={0.85}
      >
        <Feather name="message-circle" size={20} color="#fff" />
        <Text style={styles.channelCTAText}>Falar no WhatsApp</Text>
        <Feather name="external-link" size={16} color="rgba(255,255,255,0.75)" />
      </TouchableOpacity>

      <FaqSection colors={colors} />
    </ScrollView>
  );
}

// ── Email channel view ────────────────────────────────────────
function EmailView({
  config,
  colors,
  bottomPad,
  onOpen,
}: {
  config: SuporteConfig | null;
  colors: any;
  bottomPad: number;
  onOpen: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]}>
      {config?.mensagem_boas_vindas ? (
        <WelcomeBanner text={config.mensagem_boas_vindas} colors={colors} />
      ) : null}

      <View style={[styles.channelHero, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
        <View style={[styles.channelHeroIcon, { backgroundColor: colors.primary }]}>
          <Feather name="mail" size={36} color="#fff" />
        </View>
        <Text style={[styles.channelHeroTitle, { color: colors.foreground }]}>
          Suporte via E-mail
        </Text>
        <Text style={[styles.channelHeroDesc, { color: colors.mutedForeground }]}>
          Envie um e-mail para nossa equipe. Respondemos em até 24 horas úteis.
        </Text>
        {config?.email_address ? (
          <Text style={[styles.channelContact, { color: colors.primary }]}>
            {config.email_address}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.channelCTA, { backgroundColor: colors.primary }]}
        onPress={onOpen}
        activeOpacity={0.85}
      >
        <Feather name="mail" size={20} color="#fff" />
        <Text style={styles.channelCTAText}>Enviar E-mail</Text>
        <Feather name="external-link" size={16} color="rgba(255,255,255,0.75)" />
      </TouchableOpacity>

      <FaqSection colors={colors} />
    </ScrollView>
  );
}

// ── Ticket main view (channel = ticket) ───────────────────────
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

function ticketStatusColor(status: string, primary: string) {
  if (status === "closed") return "#6B7280";
  if (status === "in_progress") return "#F59E0B";
  return primary;
}
function ticketStatusLabel(status: string) {
  if (status === "closed") return "Encerrado";
  if (status === "in_progress") return "Em andamento";
  return "Aberto";
}

function TicketMainView({
  config,
  tickets,
  loading,
  colors,
  bottomPad,
  onNewTicket,
  onTicketPress,
  onRefresh,
}: {
  config: SuporteConfig | null;
  tickets: Ticket[];
  loading: boolean;
  colors: any;
  bottomPad: number;
  onNewTicket: () => void;
  onTicketPress: (ticket: Ticket) => void;
  onRefresh: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {config?.mensagem_boas_vindas ? (
        <WelcomeBanner text={config.mensagem_boas_vindas} colors={colors} />
      ) : null}

      {tickets.some((t) => t.status !== "closed") ? (
        <View style={[styles.activeTicketBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="lock" size={17} color={colors.mutedForeground} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.activeTicketBannerTitle, { color: colors.foreground }]}>
              Você já tem um chamado aberto
            </Text>
            <Text style={[styles.activeTicketBannerDesc, { color: colors.mutedForeground }]}>
              Encerre o chamado atual para poder abrir um novo.
            </Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.newTicketCard, { backgroundColor: colors.primary }]}
          onPress={onNewTicket}
          activeOpacity={0.85}
        >
          <View style={styles.newTicketCardLeft}>
            <View style={styles.newTicketIconWrap}>
              <Feather name="edit-3" size={22} color="#fff" />
            </View>
            <View>
              <Text style={styles.newTicketCardTitle}>Abrir novo chamado</Text>
              <Text style={styles.newTicketCardDesc}>Descreva seu problema para a equipe</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      )}

      {/* Ticket history */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Meus chamados</Text>

      {tickets.length === 0 && !loading ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="inbox" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyBoxText, { color: colors.mutedForeground }]}>
            Nenhum chamado aberto ainda
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {tickets.map((t) => {
            const sc = ticketStatusColor(t.status, colors.primary);
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.ticketRow,
                  { backgroundColor: colors.card, borderColor: t.has_support_reply ? "#10B981" : colors.border },
                ]}
                onPress={() => onTicketPress(t)}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.ticketAssunto, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>
                      {t.assunto}
                    </Text>
                    {t.has_support_reply && (
                      <View style={styles.replyBadge}>
                        <Feather name="message-circle" size={10} color="#fff" />
                        <Text style={styles.replyBadgeText}>Resposta</Text>
                      </View>
                    )}
                  </View>
                  {t.last_message ? (
                    <Text style={[styles.ticketLastMsg, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {t.last_message_sender_type === "admin" ? "Suporte: " : "Você: "}{t.last_message}
                    </Text>
                  ) : null}
                  <Text style={[styles.ticketTime, { color: colors.mutedForeground }]}>
                    {relTime(t.last_message_at ?? t.created_at)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <View style={[styles.statusBadge, { backgroundColor: sc + "14" }]}>
                    <View style={[styles.statusDot, { backgroundColor: sc }]} />
                    <Text style={[styles.statusLabel, { color: sc }]}>{ticketStatusLabel(t.status)}</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <FaqSection colors={colors} />
    </ScrollView>
  );
}

// ── Ticket detail view ────────────────────────────────────────
function TicketDetailView({
  ticket,
  apiKey,
  alunoToken,
  colors,
  bottomPad,
}: {
  ticket: Ticket;
  apiKey: string;
  alunoToken: string;
  colors: any;
  bottomPad: number;
}) {
  const [currentStatus, setCurrentStatus] = useState(ticket.status);
  const [messages, setMessages] = useState<TicketMensagem[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  async function fetchMessages(showLoader = false) {
    if (showLoader) setLoadingMsgs(true);
    try {
      const res = await averonApi.getTicketMensagens(apiKey, alunoToken, ticket.id);
      setMessages(res.data ?? res.messages ?? []);
    } catch {}
    finally { if (showLoader) setLoadingMsgs(false); }
  }

  useEffect(() => {
    fetchMessages(true);
    pollRef.current = setInterval(() => fetchMessages(false), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [ticket.id]);

  async function sendReply() {
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);
    const optimistic: TicketMensagem = {
      id: `opt_${Date.now()}`,
      sender_type: "aluno",
      sender_label: "Você",
      texto: text,
      mensagem: text,
      is_mine: true,
      is_support: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setReplyText("");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const res = await averonApi.sendTicketMensagem(apiKey, alunoToken, ticket.id, text);
      if (res.message) {
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? res.message : m));
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      Alert.alert("Erro", "Não foi possível enviar a mensagem. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  async function handleClose() {
    Alert.alert(
      "Encerrar chamado",
      "Tem certeza que deseja encerrar este chamado? Você poderá abrir um novo depois.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Encerrar",
          style: "destructive",
          onPress: async () => {
            setClosing(true);
            try {
              await averonApi.closeTicket(apiKey, alunoToken, ticket.id);
              setCurrentStatus("closed");
              if (pollRef.current) clearInterval(pollRef.current);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert("Erro", "Não foi possível encerrar o chamado. Tente novamente.");
            } finally {
              setClosing(false);
            }
          },
        },
      ]
    );
  }

  const sc = ticketStatusColor(currentStatus, colors.primary);
  const sl = ticketStatusLabel(currentStatus);

  if (loadingMsgs && messages.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {/* Ticket meta */}
        <View style={[styles.detailMeta, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <View style={[styles.statusBadge, { backgroundColor: sc + "14" }]}>
              <View style={[styles.statusDot, { backgroundColor: sc }]} />
              <Text style={[styles.statusLabel, { color: sc }]}>{sl}</Text>
            </View>
          </View>
          <Text style={[styles.detailMetaTime, { color: colors.mutedForeground }]}>
            Aberto {relTime(ticket.created_at)}
          </Text>
          <View style={[styles.detailMetaId, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="hash" size={11} color={colors.mutedForeground} />
            <Text style={[styles.detailMetaIdText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {ticket.id}
            </Text>
          </View>
        </View>

        {/* Chat thread */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Conversa</Text>

        {messages.length === 0 ? (
          <View style={[styles.chatAwaitBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="clock" size={14} color={colors.mutedForeground} />
            <Text style={[styles.chatAwaitText, { color: colors.mutedForeground }]}>
              Aguardando resposta da equipe de suporte.
            </Text>
          </View>
        ) : (
          messages.map((m) =>
            m.is_support ? (
              <View key={m.id} style={[styles.chatBubbleSupport, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.chatBubbleTextSupport, { color: colors.foreground }]}>{m.texto}</Text>
                <Text style={[styles.chatBubbleTimeSupport, { color: colors.mutedForeground }]}>
                  {relTime(m.created_at)} • Suporte
                </Text>
              </View>
            ) : (
              <View key={m.id} style={[styles.chatBubbleUser, { backgroundColor: colors.primary }]}>
                <Text style={styles.chatBubbleTextUser}>{m.texto}</Text>
                <Text style={styles.chatBubbleTimeUser}>{relTime(m.created_at)} • Você</Text>
              </View>
            )
          )
        )}

        {/* Close ticket button */}
        {currentStatus !== "closed" && (
          <TouchableOpacity
            style={[styles.closeTicketBtn, { borderColor: "#EF4444" }]}
            onPress={handleClose}
            disabled={closing}
            activeOpacity={0.75}
          >
            {closing ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <>
                <Feather name="x-circle" size={16} color="#EF4444" />
                <Text style={styles.closeTicketBtnText}>Encerrar chamado</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Reply input (hidden when ticket is closed) */}
        {currentStatus !== "closed" && (
          <View style={[styles.detailReplyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Enviar mensagem</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldTextarea, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
              placeholder="Escreva sua mensagem..."
              placeholderTextColor={colors.mutedForeground}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              textAlignVertical="top"
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: replyText.trim() && !sending ? colors.primary : colors.muted, marginTop: 12 }]}
              onPress={sendReply}
              disabled={!replyText.trim() || sending}
              activeOpacity={0.85}
            >
              {sending ? (
                <ActivityIndicator color={replyText.trim() ? "#fff" : colors.mutedForeground} />
              ) : (
                <>
                  <Feather name="send" size={16} color={replyText.trim() ? "#fff" : colors.mutedForeground} />
                  <Text style={[styles.sendBtnText, { color: replyText.trim() ? "#fff" : colors.mutedForeground }]}>
                    Enviar mensagem
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── New ticket form ───────────────────────────────────────────
function NewTicketView({
  apiKey,
  alunoToken,
  colors,
  bottomPad,
  onCreated,
}: {
  apiKey: string;
  alunoToken: string;
  colors: any;
  bottomPad: number;
  onCreated: (ticketId: string) => void;
}) {
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [prioridade, setPrioridade] = useState<"baixa" | "media" | "alta">("media");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!assunto.trim() || !mensagem.trim()) {
      Alert.alert("Atenção", "Preencha o assunto e a mensagem.");
      return;
    }
    setSending(true);
    try {
      const res = await averonApi.createTicket(
        apiKey,
        alunoToken,
        assunto.trim(),
        mensagem.trim(),
        prioridade
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCreated(res.ticket_id);
    } catch {
      Alert.alert("Erro", "Não foi possível enviar o chamado. Verifique sua conexão e tente novamente.");
    } finally {
      setSending(false);
    }
  }

  const PRIORIDADES: { v: "baixa" | "media" | "alta"; label: string; color: string }[] = [
    { v: "baixa", label: "Baixa", color: "#10B981" },
    { v: "media", label: "Média", color: "#F59E0B" },
    { v: "alta", label: "Alta", color: "#EF4444" },
  ];

  const canSend = assunto.trim().length > 0 && mensagem.trim().length > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Assunto *</Text>
          <TextInput
            style={[styles.fieldInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
            placeholder="Ex: Não consigo acessar a aula"
            placeholderTextColor={colors.mutedForeground}
            value={assunto}
            onChangeText={setAssunto}
            maxLength={120}
          />

          <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 16 }]}>Mensagem *</Text>
          <TextInput
            style={[styles.fieldInput, styles.fieldTextarea, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
            placeholder="Descreva seu problema em detalhes..."
            placeholderTextColor={colors.mutedForeground}
            value={mensagem}
            onChangeText={setMensagem}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{mensagem.length}/2000</Text>

          <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 16 }]}>Prioridade</Text>
          <View style={styles.prioRow}>
            {PRIORIDADES.map((p) => (
              <TouchableOpacity
                key={p.v}
                style={[
                  styles.prioBtn,
                  {
                    backgroundColor: prioridade === p.v ? p.color + "20" : colors.muted,
                    borderColor: prioridade === p.v ? p.color : colors.border,
                  },
                ]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPrioridade(p.v); }}
              >
                <View style={[styles.prioDot, { backgroundColor: p.color }]} />
                <Text style={[styles.prioLabel, { color: prioridade === p.v ? p.color : colors.mutedForeground }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: canSend && !sending ? colors.primary : colors.muted }]}
          onPress={handleSend}
          disabled={sending || !canSend}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator color={canSend ? "#fff" : colors.mutedForeground} />
          ) : (
            <>
              <Feather name="send" size={16} color={canSend ? "#fff" : colors.mutedForeground} />
              <Text style={[styles.sendBtnText, { color: canSend ? "#fff" : colors.mutedForeground }]}>
                Abrir chamado
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Shared sub-components ─────────────────────────────────────
const FAQS = [
  {
    pergunta: "Não consigo acessar meu curso, o que fazer?",
    resposta: "Verifique se seu acesso foi liberado pelo administrador. Caso tenha certeza que deveria ter acesso, entre em contato com o suporte.",
  },
  {
    pergunta: "Como assisto aulas offline?",
    resposta: "No momento, as aulas requerem conexão com a internet. Estamos trabalhando em um modo offline para versões futuras.",
  },
  {
    pergunta: "Meu progresso não está sendo salvo, o que fazer?",
    resposta: "Verifique sua conexão com a internet. O progresso é sincronizado em tempo real. Se o problema persistir, entre em contato.",
  },
  {
    pergunta: "Como altero minha senha?",
    resposta: "Acesse Perfil → Editar perfil e você encontrará a opção para alterar sua senha.",
  },
];

function WelcomeBanner({ text, colors }: { text: string; colors: any }) {
  return (
    <View style={[styles.welcomeBanner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "28" }]}>
      <Feather name="info" size={15} color={colors.primary} />
      <Text style={[styles.welcomeText, { color: colors.foreground }]}>{text}</Text>
    </View>
  );
}

function FaqSection({ colors }: { colors: any }) {
  const [exp, setExp] = useState<number | null>(null);

  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Perguntas frequentes</Text>
      {FAQS.map((faq, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.faqCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExp(exp === i ? null : i); }}
        >
          <View style={styles.faqHeader}>
            <Text style={[styles.faqPergunta, { color: colors.foreground }]} numberOfLines={exp === i ? undefined : 2}>
              {faq.pergunta}
            </Text>
            <Feather name={exp === i ? "chevron-up" : "chevron-down"} size={17} color={colors.mutedForeground} />
          </View>
          {exp === i && (
            <Text style={[styles.faqResposta, { color: colors.mutedForeground, borderTopColor: colors.border }]}>
              {faq.resposta}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  newTicketBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "flex-end" },
  title: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  content: { padding: 16, gap: 16 },

  welcomeBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 14,
  },
  welcomeText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },

  channelHero: {
    borderRadius: 20, borderWidth: 1, padding: 24,
    alignItems: "center", gap: 10,
  },
  channelHeroIcon: {
    width: 72, height: 72, borderRadius: 24,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  channelHeroTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  channelHeroDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },
  channelContact: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 4 },

  channelCTA: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, borderRadius: 16, paddingVertical: 17,
  },
  channelCTAText: { flex: 1, textAlign: "center", fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },

  newTicketCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 16, padding: 16, gap: 12,
  },
  newTicketCardLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  newTicketIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  newTicketCardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  newTicketCardDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 2 },

  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 4 },

  emptyBox: {
    borderRadius: 14, borderWidth: 1, padding: 28,
    alignItems: "center", gap: 10,
  },
  emptyBoxText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  ticketRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  ticketAssunto: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  ticketTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  prioBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  prioDotSmall: { width: 5, height: 5, borderRadius: 3 },
  prioBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  successCard: {
    borderRadius: 20, borderWidth: 1, padding: 28,
    alignItems: "center", gap: 12,
  },
  successIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  successTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  successDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },
  ticketIdRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, marginTop: 4,
    maxWidth: "100%",
  },
  ticketIdText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },

  formCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  fieldInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  fieldTextarea: { minHeight: 130, paddingTop: 12 },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right", marginTop: 4 },
  prioRow: { flexDirection: "row", gap: 10 },
  prioBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, borderWidth: 1, paddingVertical: 10 },
  prioDot: { width: 8, height: 8, borderRadius: 4 },
  prioLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 16 },
  sendBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  faqCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  faqHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  faqPergunta: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  faqResposta: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },

  detailMeta: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  detailMetaTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  detailMetaId: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
    alignSelf: "flex-start",
  },
  detailMetaIdText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  chatBubbleUser: {
    alignSelf: "flex-end", borderRadius: 16, borderBottomRightRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10, maxWidth: "85%", gap: 4,
  },
  chatBubbleTextUser: { color: "#fff", fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  chatBubbleTimeUser: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "right" },

  chatBubbleSupport: {
    alignSelf: "flex-start", borderRadius: 16, borderBottomLeftRadius: 4,
    borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, maxWidth: "85%", gap: 4,
  },
  chatBubbleTextSupport: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  chatBubbleTimeSupport: { fontSize: 10, fontFamily: "Inter_400Regular" },

  chatAwaitBanner: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  chatAwaitText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  replyBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#10B981", borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2,
  },
  replyBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },

  ticketLastMsg: { fontSize: 12, fontFamily: "Inter_400Regular" },

  closeTicketBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, paddingVertical: 13,
  },
  closeTicketBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#EF4444" },

  activeTicketBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 16,
  },
  activeTicketBannerTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  activeTicketBannerDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  detailReplyCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
});
