# Bundle, DEX, and memory optimization audit

## Status and limits

This session performed source inspection and implemented configuration/code improvements. It did **not** execute Expo export, Android Gradle, Atlas, the added tests, or a memory profiler: this editor has no command-execution tool. No before/after sizes, DEX method counts, RAM savings, or startup timings have been measured. Access to package.json and the installed dependency tree is restricted, so the earlier package removal cannot be verified. A missing direct import alone does not prove that a dependency is unnecessary.

## Implemented changes

- Local Expo config plugin enables release R8 code shrinking, optimization, name obfuscation, and Android resource shrinking via generated Gradle properties. The previous release flags directly inside expo.android were not standard Expo build-property configuration and have been replaced with an active prebuild plugin.
- The optimized Android default Proguard configuration replaces the non-optimized default. Existing application and dependency consumer/JNI/reflection rules remain intact. A small release-only rules file uses a generic source filename while retaining line information for private crash retracing.
- Hermes is explicitly selected. It was already the normal Expo default; do not treat this setting alone as a newly measured improvement.
- All application MaterialIcons imports use the single icon-family entry instead of the multi-family barrel, limiting the reachable font/module graph where bundling permits it. The icons and visual design are unchanged.
- XLSX is evaluated on the first spreadsheet import/export action, not when the Configuration module loads. This is **deferred evaluation**, not native code splitting, library removal, or a guarantee of a smaller bundle. XLS/XLSX import/export compatibility is preserved.
- Alerts, Configuration, and Performance derive filtered/sorted lists with a memoized hook rather than effect-driven duplicate list state. Search and market filtering share one pass; date/yield sort keys are computed once per row. Equal status keys now compare correctly without unnecessary reordering.
- Alert cards are memoized and receive stable action callbacks. Their details modal trees mount only when opened. Financial-card lists use conservative virtualized render windows without assumed fixed item heights or unsafe clipping.
- Extras uses FlatList and disk image caching instead of mounting its entire list through ScrollView/map. Existing card styling and images remain unchanged.
- A repeatable local bundle-analysis utility and native-plugin fixture tests were added without changing package.json or adding application libraries.

Shrinking reduces reachable native code/resources. Obfuscation makes names less readable; it does not encrypt the app, protect embedded credentials, or inherently lower RAM consumption. DEX is Java/Kotlin bytecode; Hermes JavaScript and C++ shared libraries are separate and must be measured separately. Avoid control-flow/string-encryption JavaScript obfuscators because they can increase bundle size, initialization work, and memory usage.

## Source-based dependency candidates (not a measured ranking)

| Dependency/group | Observed role | Recommendation |
| --- | --- | --- |
| xlsx | Native spreadsheet import/export; explicitly imported in excelService.native.ts | First candidate to inspect in Android Atlas. Deferred evaluation is implemented. CSV-only processing could eliminate much of this library only if losing XLS/XLSX support is explicitly acceptable; it has not been replaced. |
| @expo/vector-icons | MaterialIcons throughout the app | Retain the used family; direct family imports are implemented. Verify whether unused icon fonts disappeared in the export. |
| expo-font / expo-asset | No direct application imports, but icon font loading can require them indirectly | Do not remove on the basis of the previous direct-import-only audit. Check installed Expo peer/transitive requirements and release font rendering. |
| react-native-paper / react-native-reanimated | Search found only entries in the existing Metro transform allowlist, not application imports | Potential removal candidates, not confirmed unnecessary. A Metro allowlist is not usage. Check Expo Router/navigation and installed peer/transitive dependencies first. |
| @supabase/supabase-js | Authentication, PostgreSQL, storage-compatible API, and push-function invocation | Retain. Replacing it for size alone would risk sessions and backend functionality. |
| expo-auth-session / expo-web-browser | Existing template authentication service references; browser plugin present | Retain until the authentication dependency graph and required flows are verified. Do not remove or rewrite login as a bundle-size shortcut. |
| expo-device | Terms acceptance device audit | Retain; removing it would change compliance/audit functionality. |
| expo-notifications / expo-constants | Expo push permissions, tokens, configuration, and Android notification setup | Retain; never substitute a notification provider as a size optimization. |
| expo-file-system / expo-sharing / expo-document-picker | Spreadsheet files and sharing | Retain while the existing spreadsheet features are required. |
| Maps, Skia, WebRTC, Stripe, camera/media modules from the earlier removal request | Installed presence cannot be verified in this workspace | If still installed and genuinely unnecessary after peer/plugin checks, native autolinking can make these important APK/DEX/native-library candidates even without JS imports. Do not report them as already removed here. |

The current Metro/Babel configuration was left unchanged. No custom Metro transformer, JS obfuscator, blanket native keep rules, warning suppression, or removal of push/auth/terms functionality was introduced. No database schema or user data was changed.

## Run the actual bundle analysis on an exported checkout

Use the project's existing package manager to restore its supported dependencies first. Confirm any package removals in that checkout and preserve the lockfile.

```sh
# Repeatable production export with Atlas, source maps, byte counts, and gzip information.
node scripts/analyze-bundle.cjs android
# Analyze iOS separately; web is useful but is not a substitute for native measurement.
node scripts/analyze-bundle.cjs ios
node scripts/analyze-bundle.cjs web
```

Each run writes to a timestamped `artifacts/bundle-analysis/<platform>-<timestamp>/` directory. Open the printed Atlas path with:

```sh
npx expo-atlas "artifacts/bundle-analysis/<printed-run-directory>/atlas.jsonl"
```

The script prints the actual files and byte sizes and writes `bundle-size-report.json`. Rank dependencies by **transformed** contribution in Atlas, inspect import chains, and compare reports from before and after the changes using the same platform, SDK, build mode, and environment. Exported bundle byte counts are NOT Android download/install sizes. Gzip values are informational, particularly for Hermes bytecode. Shared and platform-specific modules must not be counted as independent user downloads.

Direct Expo command if the utility is not used:

```sh
EXPO_ATLAS=true npx expo export --platform android --source-maps
npx expo-atlas .expo/atlas.jsonl
```

Atlas and maps contain original source and inlined EXPO_PUBLIC values. Keep them private; do not publish analysis artifacts, source maps, or R8 mappings with public app assets. Preserve private copies for diagnosis.

## Android release verification

The config plugin takes effect during native prebuild, not Live Preview or an existing binary. OnSpace's next APK/AAB build must run prebuild. For a checkout with manually maintained native directories, back up custom native changes and apply prebuild rather than assuming app.json alone rewrites Gradle.

```sh
# Checks the plugin's template transformations; does not replace a release build.
node --test scripts/android-release-optimization.test.cjs

# Resolve the installed Expo config and check TypeScript.
npx expo config --type prebuild
npx tsc --noEmit

# On an exported managed checkout with Android SDK/JDK installed:
npx expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleRelease :app:bundleRelease
# Windows: gradlew.bat :app:assembleRelease :app:bundleRelease
```

Verify generated `android/gradle.properties` has the Proguard/Minify and resource-shrinking flags set to true; verify app/build.gradle uses the optimized default and includes rds-release.pro. Plugin errors are explicit if a future/custom Android template is incompatible. Verify the minification task and `android/app/build/outputs/mapping/release/mapping.txt` exist. Archive the matching mapping per app version/versionCode for retracing and Google Play crash deobfuscation; do not reuse mappings across builds.

Open the release APK/AAB in Android Studio **Build > Analyze APK**. Compare compressed/uncompressed classes*.dex sizes, defined/referenced method counts, resources, assets/Hermes bundles, and ABI-specific .so libraries. For an AAB, compare equivalent device-specific APKs/Play delivery estimates rather than treating total AAB bytes as a device's download size. Use production signing in the actual release build; this session did not change signing, ABIs, SDK levels, or application permissions.

## OnSpace R8 failure diagnostics

The reported `:app:minifyReleaseWithR8 > Compilation failed to complete` identifies the failed task, not its cause. The Gradle 9 deprecation summary is a separate warning; it does not justify upgrading the build toolchain or suppressing R8 diagnostics. The supplied build scan at https://gradle.com/s/vgz4hl6c6ecpi returned no readable content to this editor, so no underlying exception could be inspected.

The registered release plugin now writes these standard Gradle properties during Android prebuild:

```properties
org.gradle.logging.stacktrace=all
org.gradle.warning.mode=all
```

These request the equivalent of `--stacktrace --warning-mode all` without needing control of OnSpace's build command. R8 shrinking, optimization, obfuscation, resource shrinking, existing application rules, dependency consumer rules, and JVM memory settings remain unchanged. Debug logging is not enabled. No blanket keep rules or warning suppression were added. Fixture coverage was added for property deduplication, idempotence, and JVM-setting preservation; the tests and Android builds could not be executed in this editor.

Next steps:

1. Run a new Android AAB build in OnSpace that applies native prebuild. Existing binaries and logs are unaffected.
2. Share the first `ERROR: R8` / `Missing class` diagnostic and the relevant nested `Caused by` exception, rather than only the final failure summary. If available, include `android/app/build/outputs/mapping/release/missing_rules.txt` from that failed build. It is a diagnostic artifact, not a valid release mapping; do not apply its rules blindly.
3. If the preview still displays only the same short summary, open the build scan's console output in your browser or email contact@onspace.ai with the build ID/timestamp and request the complete R8 log. Command-line settings can override project properties, and the cloud UI can truncate logs; the plugin cannot control either.
4. Apply a targeted fix only after identifying the failure: resolve the specific missing dependency/consumer rule, investigate the reported R8 internal exception against the supported Expo toolchain, or address memory settings only if an out-of-memory exception is present.

This change enables diagnosis; it does **not** establish or fix the original R8 root cause. A successful minified release build is still required to validate any subsequent fix and generate its matching `mapping.txt`.

## Release behavior and memory checks

Test an installed R8-enabled release build on representative Android devices, including a lower-memory device. Live Preview cannot validate R8/JNI/FCM behavior.

- Cold/warm start and sustained tab navigation; record startup times and Android Studio Memory Profiler/System Trace measurements with identical workloads before/after.
- Login, OTP, session restoration, logout, account deletion, and terms acceptance.
- Push-token registration, foreground/background notifications, notification taps, and configured notification preferences.
- Alerts and watchlist membership/removal, both market filters, details modal opening/closing, sorting/searching, long lists, and fast scrolling without blanks.
- Spreadsheet XLS/XLSX import and export, ticker/account batch inputs, file picking, and sharing. Check first-action latency after deferred XLSX evaluation.
- Icon rendering, remote resource logos, language/theme changes, and external links.

If the smaller render window produces blank areas during fast scrolling on a target device, increase the centralized list-rendering limits based on measurements. No fixed getItemLayout was added because card height depends on markets, language, and content. No claim of a measured memory or performance gain should be made until these checks are completed.

## References

- https://docs.expo.dev/guides/analyzing-bundles/
- https://docs.expo.dev/config-plugins/plugins/
- https://docs.gradle.org/current/userguide/logging.html
- https://raw.githubusercontent.com/expo/expo/sdk-53/templates/expo-template-bare-minimum/android/app/build.gradle
