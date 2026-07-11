import { Stack } from "expo-router";
import React from "react";

import { useColors } from "@/hooks/useColors";

export default function AuthLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="login" options={{ animation: "fade" }} />
      <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      <Stack.Screen name="register" />
      <Stack.Screen name="signup-confirm" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="otp" />
    </Stack>
  );
}
