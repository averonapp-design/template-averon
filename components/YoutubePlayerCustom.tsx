import React from "react";
import { Platform, View } from "react-native";
import { WebView } from "react-native-webview";

interface Props {
  videoId: string;
  height: number;
  onReady?: () => void;
}

// iOS Safari UA — required for YouTube to serve the HTML5 player correctly
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
  "Version/17.0 Mobile/15E148 Safari/604.1";

export function YoutubePlayerCustom({ videoId, height, onReady }: Props) {
  // Load the embed URL directly as a first-party navigation instead of
  // embedding it inside an HTML <iframe>. The IFrame Player API (used by
  // react-native-youtube-iframe and our previous HTML approach) checks
  // embedder.identity via the HTTP Referer header and returns error 153
  // when it is missing — which always happens in WKWebView.
  //
  // Loading the URL directly bypasses that check entirely: YouTube treats
  // top-level WebView navigations as direct embeds and does not require
  // a Referer from the parent document.
  const embedUri = `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&fs=1`;

  return (
    <View style={{ height, backgroundColor: "#000" }}>
      <WebView
        source={{ uri: embedUri }}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
        userAgent={Platform.OS === "ios" ? IOS_UA : undefined}
        onLoadEnd={onReady}
      />
    </View>
  );
}
