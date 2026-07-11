import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { InAppBrowserProvider } from "@/context/InAppBrowserContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

function SplashController({
  fontsLoaded,
  fontError,
}: {
  fontsLoaded: boolean;
  fontError: Error | null;
}) {
  const { isLoading: authLoading } = useAuth();
  const ready = (fontsLoaded || !!fontError) && !authLoading;
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);
  return null;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="product/[id]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="order/[id]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="checkout"
        options={{ presentation: "card", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="checkout-success"
        options={{ presentation: "fullScreenModal", animation: "fade" }}
      />
      <Stack.Screen
        name="notifications"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="settings"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="support"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="qr-scanner"
        options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="admin-setup"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
  });

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <SplashController fontsLoaded={fontsLoaded} fontError={fontError} />
                <ThemeProvider>
                  <ThemedStatusBar />
                  <InAppBrowserProvider>
                    <NotificationProvider>
                      <CartProvider>
                        <RootLayoutNav />
                      </CartProvider>
                    </NotificationProvider>
                  </InAppBrowserProvider>
                </ThemeProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
