const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Safely append a compiler flag to a CocoaPods build setting (String or Array).
function makeRubyAppender(settingKey, flagValue, guardSubstring) {
  const safe = settingKey.replace(/-/g, '_');
  return [
    `      _existing_${safe} = build_config.build_settings['${settingKey}']`,
    `      if _existing_${safe}.is_a?(Array)`,
    `        unless _existing_${safe}.any? { |f| f.include?('${guardSubstring}') }`,
    `          build_config.build_settings['${settingKey}'] = _existing_${safe} + ['${flagValue}']`,
    `        end`,
    `      else`,
    `        _str_${safe} = _existing_${safe} || '$(inherited)'`,
    `        unless _str_${safe}.include?('${guardSubstring}')`,
    `          build_config.build_settings['${settingKey}'] = _str_${safe} + ' ${flagValue}'`,
    `        end`,
    `      end`,
  ].join('\n');
}

module.exports = (config) =>
  withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // Fix 1: GoogleUtilities needs modular headers for FirebaseCoreInternal (Swift pod)
      if (!podfile.includes("pod 'GoogleUtilities', :modular_headers => true")) {
        podfile = podfile.replace(
          /use_expo_modules!/,
          "use_expo_modules!\n  pod 'GoogleUtilities', :modular_headers => true"
        );
      }

      if (!podfile.includes('FOLLY_CFG_NO_COROUTINES')) {
        // Fix 2: FOLLY_CFG_NO_COROUTINES=1 — prevents Folly/Portability.h from defining
        // FOLLY_HAS_COROUTINES=1 on Xcode 26, which causes folly/coro/Coroutine.h not found.
        // CocoaPods build_settings can return String or Array; handle both types.
        const follyFix = [
          '  installer.pods_project.targets.each do |target|',
          '    target.build_configurations.each do |build_config|',
          makeRubyAppender('OTHER_CPLUSPLUSFLAGS', '-DFOLLY_CFG_NO_COROUTINES=1', 'FOLLY_CFG_NO_COROUTINES'),
          makeRubyAppender('GCC_PREPROCESSOR_DEFINITIONS', 'FOLLY_CFG_NO_COROUTINES=1', 'FOLLY_CFG_NO_COROUTINES'),
          '    end',
          '  end',

        ].join('\n');

        podfile = podfile.replace(
          /\n  end\nend\s*$/,
          `\n${follyFix}\n  end\nend\n`
        );
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
