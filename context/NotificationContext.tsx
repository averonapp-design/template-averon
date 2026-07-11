import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { averonApi } from "@/services/averon";

// expo-notifications removed remote push from Expo Go in SDK 53.
// Skip all notification setup when running inside Expo Go.
const isExpoGo = Constants.executionEnvironment === "storeClient";

if (!isExpoGo) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    // ignore
  }
}

interface NotificationContextValue {
  devicePushToken: string | null;
  permissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue>({
  devicePushToken: null,
  permissionGranted: false,
  requestPermission: async () => false,
});

export function useNotifications() {
  return useContext(NotificationContext);
}

function handleNavigation(data?: Record<string, unknown>) {
  if (!data?.screen) return;
  try {
    router.push(data.screen as any);
  } catch {
    // ignore invalid routes
  }
}

async function getFCMToken(): Promise<string | null> {
  if (Platform.OS === "web" || isExpoGo) return null;
  try {
    // Use Firebase Messaging to get the FCM token.
    // On iOS, Firebase bridges APNs → FCM internally.
    // On Android, this is the native FCM token.
    const messaging = require("@react-native-firebase/messaging").default;
    // Ensure APNs token is registered on iOS before requesting FCM token
    if (Platform.OS === "ios") {
      await messaging().registerDeviceForRemoteMessages();
    }
    const token = await messaging().getToken();
    return token ?? null;
  } catch (e) {
    console.warn("[Notifications] Failed to get FCM token:", e);
    return null;
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { apiKey, alunoToken } = useAuth();
  const [devicePushToken, setDevicePushToken] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();
  const registeredTokenRef = useRef<string | null>(null);

  // Send FCM token to the server whenever we have both auth and token
  const registerDeviceToken = useCallback(
    async (fcmToken: string) => {
      if (!apiKey || !alunoToken || !fcmToken) return;
      if (registeredTokenRef.current === `${alunoToken}:${fcmToken}`) return;
      try {
        const { getOrCreateDeviceId } = await import("@/context/AuthContext");
        const deviceId = await getOrCreateDeviceId();
        await averonApi.registerDevice(
          apiKey,
          alunoToken,
          deviceId,
          Platform.OS === "ios" ? "ios" : "android",
          fcmToken
        );
        registeredTokenRef.current = `${alunoToken}:${fcmToken}`;
        console.log("[Notifications] Device registered for push");
      } catch (e) {
        console.warn("[Notifications] registerDevice error:", e);
      }
    },
    [apiKey, alunoToken]
  );

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web" || isExpoGo) return false;
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;

      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        setPermissionGranted(false);
        return false;
      }

      setPermissionGranted(true);

      const fcmToken = await getFCMToken();
      if (fcmToken) {
        setDevicePushToken(fcmToken);
        await registerDeviceToken(fcmToken);
      }

      return true;
    } catch (e) {
      console.warn("[Notifications] requestPermission error:", e);
      setPermissionGranted(false);
      return false;
    }
  }, [registerDeviceToken]);

  // On mount: if permission already granted, fetch token and register
  useEffect(() => {
    if (Platform.OS === "web" || isExpoGo) return;

    Notifications.getPermissionsAsync()
      .then(async ({ status }) => {
        if (status === "granted") {
          setPermissionGranted(true);
          const fcmToken = await getFCMToken();
          if (fcmToken) {
            setDevicePushToken(fcmToken);
            registerDeviceToken(fcmToken);
          }
        }
      })
      .catch(() => {});

    try {
      notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          handleNavigation(response.notification.request.content.data as Record<string, unknown>);
        }
      );
    } catch {
      // Listeners not available in this environment
    }

    // Listen for FCM token refresh and re-register
    let unsubscribeRefresh: (() => void) | undefined;
    try {
      const messaging = require("@react-native-firebase/messaging").default;
      unsubscribeRefresh = messaging().onTokenRefresh(async (newToken: string) => {
        console.log("[Notifications] FCM token refreshed");
        setDevicePushToken(newToken);
        registeredTokenRef.current = null; // force re-registration
        registerDeviceToken(newToken);
      });
    } catch {
      // Firebase not available in this environment
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      unsubscribeRefresh?.();
    };
  }, [registerDeviceToken]);

  // Re-register whenever the user logs in (alunoToken changes)
  useEffect(() => {
    if (!alunoToken || !devicePushToken || Platform.OS === "web" || isExpoGo) return;
    registeredTokenRef.current = null; // reset so it re-registers for the new session
    registerDeviceToken(devicePushToken);
  }, [alunoToken, devicePushToken, registerDeviceToken]);

  useEffect(() => {
    if (Platform.OS === "web" || isExpoGo) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        Notifications.getPermissionsAsync()
          .then(({ status }) => setPermissionGranted(status === "granted"))
          .catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <NotificationContext.Provider value={{ devicePushToken, permissionGranted, requestPermission }}>
      {children}
    </NotificationContext.Provider>
  );
}
