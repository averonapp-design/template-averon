import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useInAppBrowser } from "@/context/InAppBrowserContext";
import { useColors } from "@/hooks/useColors";
import { averonApi, CursoDetalhado, Aula, Modulo } from "@/services/averon";
import { setLesson } from "@/stores/lessonCache";

function formatDuration(seg: number): string {
  if (!seg) return "";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m > 0 ? `${m}min${s > 0 ? ` ${s}s` : ""}` : `${s}s`;
}

function formatLiberaEm(data: string | null | undefined): string {
  if (!data) return "Em breve";
  const ms = new Date(data).getTime() - Date.now();
  if (ms <= 0) return "Em breve";
  const dias = Math.floor(ms / 86400000);
  const horas = Math.floor((ms % 86400000) / 3600000);
  if (dias > 0) return `Libera em ${dias} dia${dias !== 1 ? "s" : ""}`;
  if (horas > 0) return `Libera em ${horas}h`;
  const min = Math.floor((ms % 3600000) / 60000);
  return `Libera em ${min > 0 ? `${min}min` : "instantes"}`;
}

function formatDataAbsoluta(data: string | null | undefined): string {
  if (!data) return "";
  const d = new Date(data);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function ContentTypeIcon({ tipo, colors }: { tipo: string; colors: any }) {
  const icon =
    tipo === "pdf" ? "file-text" : tipo === "texto" ? "align-left" : "play";
  return <Feather name={icon as any} size={12} color={colors.primary} />;
}

export default function CourseDetailScreen() {
  const { id, autoModuloId } = useLocalSearchParams<{ id: string; autoModuloId?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { apiKey, alunoToken } = useAuth();
  const { openUrl } = useInAppBrowser();
  const [curso, setCurso] = useState<CursoDetalhado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [semAcessoLink, setSemAcessoLink] = useState<string | null>(null);
  const [partialAccess, setPartialAccess] = useState(false);
  const [expandedModulos, setExpandedModulos] = useState<Set<string>>(new Set());

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  async function loadCurso() {
    if (!id || !apiKey) { setLoading(false); return; }
    setLoading(true);
    setError("");

    const MAX_ATTEMPTS = 3;
    let lastErr: any;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));
        const c = await averonApi.getCurso(apiKey, alunoToken, id);
        setCurso(c);
        if (autoModuloId) {
          const alvo = c.modulos?.find((m) => m.id === autoModuloId);
          // Find the first available (not drip-locked) lesson
          const primeiraAula = alvo?.aulas
            ?.slice()
            .sort((a, b) => a.ordem - b.ordem)
            .find((a) => a.disponivel !== false);
          if (primeiraAula) {
            setLesson(primeiraAula, c);
            router.replace(
              `/lesson/${primeiraAula.id}?titulo=${encodeURIComponent(primeiraAula.titulo)}&conteudo_tipo=${primeiraAula.conteudo_tipo ?? "video"}`
            );
            setLoading(false);
            return;
          }
          setExpandedModulos(new Set([autoModuloId]));
        } else {
          // Auto-skip course screen when there is exactly 1 module with 1 lesson
          const modulos = c.modulos ?? [];
          if (modulos.length === 1 && (modulos[0].aulas?.length ?? 0) === 1) {
            const umaAula = modulos[0].aulas[0];
            if (umaAula.disponivel !== false) {
              setLesson(umaAula, c);
              router.replace(
                `/lesson/${umaAula.id}?titulo=${encodeURIComponent(umaAula.titulo)}&conteudo_tipo=${umaAula.conteudo_tipo ?? "video"}`
              );
              setLoading(false);
              return;
            }
          }
          if (modulos.length > 0) {
            setExpandedModulos(new Set([modulos[0].id]));
          }
        }
        setLoading(false);
        return;
      } catch (e: any) {
        lastErr = e;
        if (e?.code === "sem_acesso") break;
      }
    }

    if (lastErr?.code === "sem_acesso") {
      // Check if the 403 response included free modules/lessons
      const freeModulos = lastErr?.modulos as Modulo[] | null;
      const hasFreeContent = freeModulos?.some(
        (m: Modulo) => m.gratis_cadastro || m.aulas?.some((a: Aula) => a.gratis_cadastro)
      );
      if (hasFreeContent) {
        // Render a partial course showing only free modules/lessons
        setCurso({
          id: id!,
          titulo: "",
          descricao: "",
          capa_url: null,
          publicado: true,
          created_at: "",
          modulos: freeModulos!,
        } as CursoDetalhado);
        setSemAcessoLink(lastErr.link_sem_acesso ?? null);
        setPartialAccess(true);
        // Auto-expand the first free module
        const firstFree = freeModulos!.find((m) => m.gratis_cadastro || m.aulas?.some((a) => a.gratis_cadastro));
        if (firstFree) setExpandedModulos(new Set([firstFree.id]));
      } else {
        setSemAcessoLink(lastErr.link_sem_acesso ?? null);
        setError("sem_acesso");
      }
    } else {
      setError("Não foi possível carregar o curso.");
    }
    setLoading(false);
  }

  useEffect(() => { loadCurso(); }, [id, apiKey, alunoToken]);

  function toggleModulo(mid: string) {
    setExpandedModulos((prev) => {
      const next = new Set(prev);
      next.has(mid) ? next.delete(mid) : next.add(mid);
      return next;
    });
  }

  function totalAulas() {
    return curso?.modulos?.reduce((acc, m) => acc + (m.aulas?.length ?? 0), 0) ?? 0;
  }

  function openLesson(aula: Aula) {
    if (aula.disponivel === false) return;
    // In partial access mode, only free lessons can be opened
    if (partialAccess && !aula.gratis_cadastro) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLesson(aula, curso ?? undefined);
    router.push(
      `/lesson/${aula.id}?titulo=${encodeURIComponent(aula.titulo)}&conteudo_tipo=${aula.conteudo_tipo ?? "video"}`
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // Sem acesso
  if (error === "sem_acesso") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <View style={[styles.lockBig, { backgroundColor: colors.muted }]}>
          <Feather name="lock" size={40} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.semAcessoTitle, { color: colors.foreground }]}>
          Curso bloqueado
        </Text>
        <Text style={[styles.semAcessoDesc, { color: colors.mutedForeground }]}>
          Você não tem acesso a este curso ainda.
        </Text>
        <View style={styles.semAcessoActions}>
          {semAcessoLink ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => openUrl(semAcessoLink!)}
            >
              <Feather name="external-link" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Obter acesso</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.actionBtnOutline, { borderColor: colors.border }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.actionBtnOutlineText, { color: colors.foreground }]}>
              Voltar
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error || !curso) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
          {error || "Curso não encontrado."}
        </Text>
        <TouchableOpacity
          onPress={loadCurso}
          style={[styles.actionBtn, { backgroundColor: colors.primary, marginBottom: 10 }]}
        >
          <Text style={styles.actionBtnText}>Tentar novamente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.actionBtnOutline, { borderColor: colors.border }]}
        >
          <Text style={[styles.actionBtnOutlineText, { color: colors.foreground }]}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Capa */}
        {curso.capa_url ? (
          <Image source={{ uri: curso.capa_url }} style={styles.capa} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.capa, styles.capaPlaceholder, { backgroundColor: colors.primary }]}>
            <Feather name="play-circle" size={56} color="rgba(255,255,255,0.8)" />
          </View>
        )}

        {/* Back button */}
        <TouchableOpacity style={[styles.backOverlay, { top: topPad + 12 }]} onPress={() => router.back()}>
          <View style={styles.backOverlayBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Info do curso */}
        <View style={{ padding: 20 }}>
          <Text style={[styles.courseTitle, { color: colors.foreground }]}>{curso.titulo}</Text>
          {curso.descricao ? (
            <Text style={[styles.courseDesc, { color: colors.mutedForeground }]}>{curso.descricao}</Text>
          ) : null}

          {/* DRIP: curso travado por tempo */}
          {curso.disponivel === false && (
            <View style={[styles.dripBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <View style={[styles.dripIconWrap, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="clock" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dripTitle, { color: colors.foreground }]}>
                  {formatLiberaEm(curso.liberado_em)}
                </Text>
                {curso.liberado_em ? (
                  <Text style={[styles.dripDate, { color: colors.mutedForeground }]}>
                    Disponível a partir de {formatDataAbsoluta(curso.liberado_em)}
                  </Text>
                ) : null}
              </View>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={[styles.statChip, { backgroundColor: colors.muted }]}>
              <Feather name="layers" size={13} color={colors.mutedForeground} />
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                {curso.modulos?.length ?? 0} módulos
              </Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: colors.muted }]}>
              <Feather name="play" size={13} color={colors.mutedForeground} />
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                {totalAulas()} aulas
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Módulos */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Text style={[styles.modulosTitle, { color: colors.foreground }]}>Conteúdos</Text>

          {(curso.modulos ?? []).length === 0 ? (
            <View style={[styles.emptyModulos, { backgroundColor: colors.muted }]}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Nenhum módulo disponível ainda.
              </Text>
            </View>
          ) : (
            (curso.modulos ?? [])
              .sort((a, b) => a.ordem - b.ordem)
              .map((modulo, mIdx) => (
                <ModuloCard
                  key={modulo.id}
                  modulo={modulo}
                  mIdx={mIdx}
                  isOpen={expandedModulos.has(modulo.id)}
                  colors={colors}
                  partialAccess={partialAccess}
                  semAcessoLink={semAcessoLink}
                  onToggle={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleModulo(modulo.id);
                  }}
                  onOpenLesson={openLesson}
                  onGetAccess={semAcessoLink ? () => openUrl(semAcessoLink!) : undefined}
                />
              ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function ModuloCard({
  modulo, mIdx, isOpen, colors, partialAccess, semAcessoLink, onToggle, onOpenLesson, onGetAccess,
}: {
  modulo: Modulo; mIdx: number; isOpen: boolean; colors: any;
  partialAccess: boolean; semAcessoLink: string | null;
  onToggle: () => void; onOpenLesson: (aula: Aula) => void;
  onGetAccess?: () => void;
}) {
  // DRIP lock — time-based, always respected even for gratis content
  const dripLocked = modulo.disponivel === false;
  // In partial access mode, non-free modules are locked (sem_acesso)
  const accessLocked = partialAccess && !modulo.gratis_cadastro;
  const moduloLocked = dripLocked || accessLocked;

  return (
    <View style={[
      styles.moduloCard,
      { borderColor: modulo.gratis_cadastro && partialAccess ? "#10B98140" : colors.border, backgroundColor: colors.card },
      moduloLocked && { opacity: 0.72 },
    ]}>
      {modulo.capa_url ? (
        <Image source={{ uri: modulo.capa_url }} style={styles.moduloCapa} contentFit="cover" cachePolicy="memory-disk" />
      ) : null}

      <TouchableOpacity
        style={styles.moduloHeader}
        onPress={moduloLocked ? undefined : onToggle}
        activeOpacity={moduloLocked ? 1 : 0.7}
      >
        <View style={[
          styles.moduloNumBadge,
          {
            backgroundColor: moduloLocked
              ? colors.muted
              : modulo.gratis_cadastro
              ? "#10B98118"
              : colors.primary + "18",
          },
        ]}>
          {moduloLocked
            ? <Feather name="lock" size={14} color={colors.mutedForeground} />
            : modulo.gratis_cadastro
            ? <Feather name="gift" size={14} color="#10B981" />
            : <Text style={[styles.moduloNum, { color: colors.primary }]}>{mIdx + 1}</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={[styles.moduloTitulo, { color: moduloLocked ? colors.mutedForeground : colors.foreground }]}>
              {modulo.titulo}
            </Text>
            {modulo.gratis_cadastro && (
              <View style={[styles.gratisChip, { backgroundColor: "#10B98118" }]}>
                <Text style={[styles.gratisChipText, { color: "#10B981" }]}>Grátis</Text>
              </View>
            )}
          </View>
          {dripLocked ? (
            <View style={styles.aulaMetaRow}>
              <Feather name="clock" size={10} color={colors.mutedForeground} />
              <Text style={[styles.moduloAulaCount, { color: colors.mutedForeground }]}>
                {formatLiberaEm(modulo.liberado_em)}
                {modulo.liberado_em ? ` · ${formatDataAbsoluta(modulo.liberado_em)}` : ""}
              </Text>
            </View>
          ) : (
            <Text style={[styles.moduloAulaCount, { color: colors.mutedForeground }]}>
              {modulo.aulas?.length ?? 0} aulas
            </Text>
          )}
        </View>
        {!moduloLocked && (
          <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
        )}
      </TouchableOpacity>

      {isOpen && (modulo.aulas ?? []).length > 0 && (
        <View style={[styles.aulasList, { borderTopColor: colors.border }]}>
          {(modulo.aulas ?? [])
            .sort((a, b) => a.ordem - b.ordem)
            .map((aula, aIdx) => {
              const dripLk = aula.disponivel === false;
              // In partial access: non-free lessons are locked even if drip-available
              const accessLk = partialAccess && !aula.gratis_cadastro;
              const locked = dripLk || accessLk;
              const isLast = aIdx === modulo.aulas.length - 1;
              const borderStyle = !isLast ? { borderBottomWidth: 1, borderBottomColor: colors.border } : {};

              if (locked) {
                return (
                  <TouchableOpacity
                    key={aula.id}
                    style={[styles.aulaItem, borderStyle, { opacity: 0.55 }]}
                    onPress={accessLk && onGetAccess ? onGetAccess : undefined}
                    activeOpacity={accessLk && onGetAccess ? 0.7 : 1}
                  >
                    <View style={[styles.aulaPlayBtn, { backgroundColor: colors.muted }]}>
                      <Feather name={dripLk ? "clock" : "lock"} size={12} color={colors.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.aulaTitulo, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {aula.titulo}
                      </Text>
                      <View style={styles.aulaMetaRow}>
                        <View style={[styles.tipoChip, { backgroundColor: colors.muted }]}>
                          {dripLk ? (
                            <>
                              <Feather name="clock" size={9} color={colors.mutedForeground} />
                              <Text style={[styles.tipoText, { color: colors.mutedForeground }]}>
                                {formatLiberaEm(aula.disponivel_em)}
                              </Text>
                            </>
                          ) : (
                            <Text style={[styles.tipoText, { color: colors.mutedForeground }]}>
                              {semAcessoLink ? "Obter acesso" : "Bloqueado"}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={aula.id}
                  style={[styles.aulaItem, borderStyle]}
                  onPress={() => onOpenLesson(aula)}
                >
                  {aula.capa_url ? (
                    <Image source={{ uri: aula.capa_url }} style={styles.aulaThumbnail} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <View style={[styles.aulaPlayBtn, {
                      backgroundColor: aula.gratis_cadastro ? "#10B98115" : colors.primary + "15",
                    }]}>
                      <Feather
                        name={aula.gratis_cadastro ? "gift" : aula.conteudo_tipo === "pdf" ? "file-text" : aula.conteudo_tipo === "texto" ? "align-left" : "play"}
                        size={12}
                        color={aula.gratis_cadastro ? "#10B981" : colors.primary}
                      />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.aulaTitulo, { color: colors.foreground }]} numberOfLines={2}>
                      {aula.titulo}
                    </Text>
                    <View style={styles.aulaMetaRow}>
                      {aula.gratis_cadastro && (
                        <View style={[styles.tipoChip, { backgroundColor: "#10B98118" }]}>
                          <Text style={[styles.tipoText, { color: "#10B981" }]}>Grátis</Text>
                        </View>
                      )}
                      {aula.duracao_seg > 0 && (
                        <Text style={[styles.aulaDuracao, { color: colors.mutedForeground }]}>
                          {Math.floor(aula.duracao_seg / 60)}min
                        </Text>
                      )}
                      {aula.conteudo_tipo !== "video" && !aula.gratis_cadastro && (
                        <View style={[styles.tipoChip, { backgroundColor: colors.muted }]}>
                          <Text style={[styles.tipoText, { color: colors.mutedForeground }]}>
                            {aula.conteudo_tipo === "pdf" ? "PDF" : "Texto"}
                          </Text>
                        </View>
                      )}
                      {(aula.anexos?.length ?? 0) > 0 && (
                        <View style={[styles.tipoChip, { backgroundColor: colors.muted }]}>
                          <Feather name="paperclip" size={9} color={colors.mutedForeground} />
                          <Text style={[styles.tipoText, { color: colors.mutedForeground }]}>
                            {aula.anexos!.length} anexo{aula.anexos!.length > 1 ? "s" : ""}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
              );
            })}
        </View>
      )}

      {/* "Obter acesso" button at bottom for access-locked modules */}
      {accessLocked && onGetAccess && (
        <TouchableOpacity
          style={[styles.getAccessBtn, { backgroundColor: colors.primary }]}
          onPress={onGetAccess}
        >
          <Feather name="unlock" size={14} color="#fff" />
          <Text style={styles.getAccessBtnText}>Obter acesso</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  errorText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  lockBig: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  semAcessoTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  semAcessoDesc: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  semAcessoActions: { gap: 10, width: "100%" },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  actionBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  actionBtnOutline: {
    alignItems: "center", justifyContent: "center",
    paddingVertical: 13, borderRadius: 14, borderWidth: 1,
  },
  actionBtnOutlineText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  capa: { width: "100%", height: 240 },
  capaPlaceholder: { alignItems: "center", justifyContent: "center" },
  backOverlay: { position: "absolute", left: 16 },
  backOverlayBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  courseTitle: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 8 },
  courseDesc: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22, marginBottom: 14 },
  statsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  statChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  statText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  divider: { height: 1, marginBottom: 20 },
  modulosTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 14 },
  emptyModulos: { borderRadius: 12, padding: 20, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  dripBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16,
  },
  dripIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dripTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  dripDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  moduloCard: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  moduloCapa: { width: "100%", height: 130 },
  moduloHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  moduloNumBadge: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  moduloNum: { fontSize: 14, fontFamily: "Inter_700Bold" },
  moduloTitulo: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  moduloAulaCount: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  gratisChip: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
  },
  gratisChipText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  getAccessBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, margin: 12, marginTop: 4, paddingVertical: 10, borderRadius: 10,
  },
  getAccessBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  aulasList: { borderTopWidth: 1 },
  aulaItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  aulaThumbnail: { width: 64, height: 40, borderRadius: 6 },
  aulaPlayBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  aulaTitulo: { fontSize: 14, fontFamily: "Inter_500Medium" },
  aulaMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" },
  aulaDuracao: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tipoChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  tipoText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
});
