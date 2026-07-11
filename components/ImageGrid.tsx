import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Lightbox ──────────────────────────────────────────────────────────────────

interface LightboxProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

function Lightbox({ images, initialIndex, onClose }: LightboxProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const listRef = useRef<FlatList>(null);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={lb.backdrop}>
        <StatusBar hidden />

        {/* Close button */}
        <Pressable
          style={[lb.closeBtn, { top: insets.top + (Platform.OS === "android" ? 8 : 12) }]}
          onPress={onClose}
          hitSlop={16}
        >
          <Feather name="x" size={22} color="#fff" />
        </Pressable>

        {/* Counter */}
        {images.length > 1 && (
          <View style={[lb.counter, { top: insets.top + (Platform.OS === "android" ? 14 : 18) }]}>
            <Text style={lb.counterText}>{currentIndex + 1} / {images.length}</Text>
          </View>
        )}

        {/* Image pager */}
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
            setCurrentIndex(idx);
          }}
          renderItem={({ item }) => (
            <ScrollView
              style={{ width: SW, height: SH }}
              contentContainerStyle={lb.imgContainer}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              centerContent
            >
              <Image
                source={{ uri: item }}
                style={{ width: SW, height: SH }}
                resizeMode="contain"
              />
            </ScrollView>
          )}
        />

        {/* Dot indicators */}
        {images.length > 1 && (
          <View style={[lb.dots, { bottom: insets.bottom + 20 }]}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[lb.dot, { opacity: i === currentIndex ? 1 : 0.4 }]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const lb = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000" },
  closeBtn: {
    position: "absolute", left: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
  },
  counter: {
    position: "absolute", right: 16, zIndex: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  counterText: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium" },
  imgContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  dots: {
    position: "absolute", left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
});

// ── ImageGrid ─────────────────────────────────────────────────────────────────

interface ImageGridProps {
  urls: string[];
}

export function ImageGrid({ urls }: ImageGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!urls || urls.length === 0) return null;

  const open = (i: number) => setLightboxIndex(i);
  const close = () => setLightboxIndex(null);

  return (
    <>
      <View style={grid.container}>
        {urls.length === 1 && (
          <TouchableOpacity activeOpacity={0.92} onPress={() => open(0)} style={grid.single}>
            <Image source={{ uri: urls[0] }} style={grid.singleImg} resizeMode="cover" />
          </TouchableOpacity>
        )}

        {urls.length === 2 && (
          <View style={grid.row}>
            {urls.map((uri, i) => (
              <TouchableOpacity key={i} activeOpacity={0.92} onPress={() => open(i)} style={grid.half}>
                <Image source={{ uri }} style={grid.halfImg} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {urls.length === 3 && (
          <>
            <TouchableOpacity activeOpacity={0.92} onPress={() => open(0)} style={grid.mainThird}>
              <Image source={{ uri: urls[0] }} style={grid.mainThirdImg} resizeMode="cover" />
            </TouchableOpacity>
            <View style={grid.row}>
              {urls.slice(1).map((uri, i) => (
                <TouchableOpacity key={i} activeOpacity={0.92} onPress={() => open(i + 1)} style={grid.half}>
                  <Image source={{ uri }} style={grid.halfImg} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {urls.length >= 4 && (
          <>
            <TouchableOpacity activeOpacity={0.92} onPress={() => open(0)} style={grid.mainThird}>
              <Image source={{ uri: urls[0] }} style={grid.mainThirdImg} resizeMode="cover" />
            </TouchableOpacity>
            <View style={grid.row}>
              {urls.slice(1, 3).map((uri, i) => (
                <TouchableOpacity key={i} activeOpacity={0.92} onPress={() => open(i + 1)} style={grid.half}>
                  <Image source={{ uri }} style={grid.halfImg} resizeMode="cover" />
                  {i === 1 && urls.length > 3 && (
                    <View style={grid.overlay}>
                      <Text style={grid.overlayText}>+{urls.length - 3}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      {lightboxIndex !== null && (
        <Lightbox images={urls} initialIndex={lightboxIndex} onClose={close} />
      )}
    </>
  );
}

const grid = StyleSheet.create({
  container: { width: "100%", gap: 2 },
  row: { flexDirection: "row", gap: 2 },

  single: { width: "100%", aspectRatio: 16 / 9, overflow: "hidden" },
  singleImg: { width: "100%", height: "100%" },

  half: { flex: 1, aspectRatio: 1, overflow: "hidden" },
  halfImg: { width: "100%", height: "100%" },

  mainThird: { width: "100%", aspectRatio: 16 / 9, overflow: "hidden" },
  mainThirdImg: { width: "100%", height: "100%" },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
    alignItems: "center", justifyContent: "center",
  },
  overlayText: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
});
