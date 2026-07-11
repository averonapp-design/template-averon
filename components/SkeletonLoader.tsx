import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: colors.muted,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function ProductCardSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Skeleton height={140} borderRadius={8} />
      <View style={styles.cardBody}>
        <Skeleton height={12} width="60%" />
        <Skeleton height={18} style={{ marginTop: 6 }} />
        <Skeleton height={14} width="80%" style={{ marginTop: 4 }} />
        <Skeleton height={14} width="40%" style={{ marginTop: 16 }} />
      </View>
    </View>
  );
}

export function OrderCardSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Skeleton height={16} width="40%" />
      <Skeleton height={14} width="60%" style={{ marginTop: 6 }} />
      <Skeleton height={20} width="30%" style={{ marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 12,
  },
  cardBody: {
    padding: 12,
    gap: 4,
  },
  orderCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
});
