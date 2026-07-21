// app.config.js
import fs from 'fs';
import path from 'path';

let env = process.env;

// Carrega variáveis do env.json (injetadas pelo CI) se existir
const envJsonPath = path.join(process.cwd(), 'env.json');
if (fs.existsSync(envJsonPath)) {
  try {
    const fileEnv = JSON.parse(fs.readFileSync(envJsonPath, 'utf8'));
    env = { ...process.env, ...fileEnv };
  } catch (e) {
    console.error('Erro ao ler env.json:', e);
  }
}

const appName = env.APP_NAME || "Seleta Comunidade";
const appSlug = env.APP_SLUG || "seletacomunidade";
const iconPath = env.APP_ICON_PATH || "./assets/images/icon.png";
const bundleIos = env.IOS_BUNDLE_ID || "com.seletacomunidade.app";
const pkgAndroid = env.ANDROID_PACKAGE || "com.seletacomunidade.app";
const version = env.APP_VERSION || "1.0.0";
const easProjectId = env.EXPO_PROJECT_ID || "55d940a5-19e7-4ef1-80cd-e017fa8e6762";
const googleServicesIos = env.GOOGLE_SERVICES_IOS_PATH || "./GoogleService-Info.plist";
const googleServicesAndroid = env.GOOGLE_SERVICES_ANDROID_PATH || "./google-services.json";

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
      buildNumber: String(env.APP_BUILD_NUMBER || env.GITHUB_RUN_NUMBER || "1"),
      entitlements: {
        "aps-environment": "production",
      },
      infoPlist: {
        NSCameraUsageDescription: "Usado para escanear QR Codes promocionais",
        NSFaceIDUsageDescription: "Usado para autenticação biométrica segura",
        NSPhotoLibraryAddUsageDescription: "Necessário para salvar figurinhas na sua galeria de fotos",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: pkgAndroid,
      versionCode: Number(env.APP_BUILD_NUMBER || env.GITHUB_RUN_NUMBER || 4),
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
            deploymentTarget: "16.4",
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
      [
        "@react-native-firebase/app",
        {
          iosCredentials: googleServicesIos,
          androidCredentials: googleServicesAndroid,
        }
      ],
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
      apiKey: env.EXPO_PUBLIC_API_KEY,
      tenantId: env.EXPO_PUBLIC_TENANT_ID,
      apiUrl: env.EXPO_PUBLIC_API_URL,
    },
    owner: "averon",
  },
};
