import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const { width } = Dimensions.get("window");

interface Slide {
  id: string;
  icon: string;
  titulo: string;
  descricao: string;
  cor: string;
}

const SLIDES: Slide[] = [
  {
    id: "1",
    icon: "play-circle",
    titulo: "Seus cursos, onde estiver",
    descricao:
      "Acesse todos os seus cursos e aulas a qualquer hora, direto pelo celular. Aprendizado sem limites.",
    cor: "#2563EB",
  },
  {
    id: "2",
    icon: "book-open",
    titulo: "Módulos e aulas organizados",
    descricao:
      "Navegue pelos módulos do seu curso com facilidade. Cada aula no lugar certo, do jeito que você precisa.",
    cor: "#7C3AED",
  },
  {
    id: "3",
    icon: "award",
    titulo: "Evolua no seu ritmo",
    descricao:
      "Estude no seu tempo, acompanhe seu progresso e domine cada conteúdo sem pressa.",
    cor: "#059669",
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleNext() {
    if (currentIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      await AsyncStorage.setItem("averon_onboarding_done", "true");
      router.replace("/(auth)/login");
    }
  }

  function handleSkip() {
    AsyncStorage.setItem("averon_onboarding_done", "true");
    router.replace("/(auth)/login");
  }

  const slide = SLIDES[currentIndex];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.logoHeader, { paddingTop: topPad + 20 }]}>
        <Image
          source={require("../../assets/images/icon.png")}
          style={styles.logoImg}
        />
      </View>
      <FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <LinearGradient
              colors={[item.cor + "18", "transparent"]}
              style={styles.slideGradient}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: item.cor + "20", borderColor: item.cor + "40" },
                ]}
              >
                <Feather name={item.icon as any} size={48} color={item.cor} />
              </View>
            </LinearGradient>

            <Text style={[styles.titulo, { color: colors.foreground }]}>
              {item.titulo}
            </Text>
            <Text style={[styles.descricao, { color: colors.mutedForeground }]}>
              {item.descricao}
            </Text>
          </View>
        )}
      />

      <View style={[styles.bottom, { paddingBottom: bottomPad + 24 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === currentIndex ? colors.primary : colors.border,
                  width: i === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: colors.primary }]}
          onPress={handleNext}
        >
          <Text style={[styles.nextText, { color: colors.primaryForeground }]}>
            {currentIndex === SLIDES.length - 1 ? "Começar" : "Próximo"}
          </Text>
          <Feather
            name={currentIndex === SLIDES.length - 1 ? "check" : "arrow-right"}
            size={18}
            color={colors.primaryForeground}
          />
        </TouchableOpacity>

        {currentIndex < SLIDES.length - 1 && (
          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
              Pular
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  slideGradient: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 48,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 16,
  },
  descricao: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
  },
  bottom: {
    paddingHorizontal: 24,
    gap: 16,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
  },
  nextText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  logoHeader: {
    alignItems: "center",
    paddingBottom: 8,
  },
  logoImg: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});
