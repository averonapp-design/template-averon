const { withAndroidManifest } = require('expo/config-plugins');

module.exports = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return config;

    const metaData = application['meta-data'] ?? [];

    for (const entry of metaData) {
      const name = entry.$?.['android:name'];
      if (name === 'com.google.firebase.messaging.default_notification_color') {
        entry.$['tools:replace'] = 'android:resource';
      }
    }

    if (!manifest.manifest.$) manifest.manifest.$ = {};
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    return config;
  });
