// app.config.js
const appName = process.env.APP_NAME || "Seleta Comunidade";
const appSlug = process.env.APP_SLUG || "seletacomunidade";
const iconPath = process.env.APP_ICON_PATH || "./assets/images/icon.png";
const bundleIos = process.env.IOS_BUNDLE_ID || "com.seletacomunidade.app";
const pkgAndroid = process.env.ANDROID_PACKAGE || "com.seletacomunidade.app";
const version = process.env.APP_VERSION || "1.0.0";
const easProjectId = process.env.EXPO_PROJECT_ID || "55d940a5-19e7-4ef1-80cd-e017fa8e6762";
const googleServicesIos = process.env.GOOGLE_SERVICES_IOS_PATH || "./GoogleService-Info.plist";
const googleServicesAndroid = process.env.GOOGLE_SERVICES_ANDROID_PATH || "./google-services.json";

export default {
  expo: {
    name: appName,
    slug: appSlug,
    version,
    orientation: "portrait",
    icon: iconPath,
    scheme: appSlug,
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "cover",
      backgroundColor: "#0F172A",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: bundleIos,
      googleServicesFile: googleServicesIos,
      icon: iconPath,
      infoPlist: {
        NSCameraUsageDescription: "Usado para escanear QR Codes promocionais",
        NSFaceIDUsageDescription: "Usado para autenticação biométrica segura",
        NSPhotoLibraryAddUsageDescription: "Necessário para salvar figurinhas na sua galeria de fotos",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: pkgAndroid,
      versionCode: 4,
      googleServicesFile: googleServicesAndroid,
      adaptiveIcon: {
        foregroundImage: iconPath,
        backgroundColor: "#0F172A",
      },
      permissions: [
        "CAMERA",
        "READ_MEDIA_IMAGES",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
        "android.permission.ACCESS_MEDIA_LOCATION",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO",
      ],
    },
    web: {
      favicon: "./assets/images/favicon.png",
      name: appName,
      shortName: appName,
      description: "Plataforma da Seleta Comunidade. Acesse conteúdos, conquistas e comunidade.",
      backgroundColor: "#0F172A",
      themeColor: "#0F172A",
    },
    plugins: [
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "15.1",
            buildReactNativeFromSource: true,
          },
        },
      ],
      [
        "expo-router",
        {
          origin: "https://replit.com/",
        },
      ],
      "./plugins/withGoogleUtilitiesModularHeaders",
      "./plugins/withFirebaseMessagingManifestFix",
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      [
        "expo-notifications",
        {
          icon: iconPath,
          color: "#0F172A",
          sounds: [],
        },
      ],
      [
        "expo-font",
        {
          fonts: [
            "./node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf",
          ],
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission: "Necessário para salvar figurinhas na galeria",
          savePhotosPermission: "Necessário para salvar figurinhas na galeria",
          isAccessMediaLocationEnabled: true,
        },
      ],
      "expo-web-browser",
      "expo-secure-store",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {
        origin: "https://replit.com/",
      },
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
      apiKey: process.env.EXPO_PUBLIC_API_KEY,
      tenantId: process.env.EXPO_PUBLIC_TENANT_ID,
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
    },
    owner: "averon",
  },
};
