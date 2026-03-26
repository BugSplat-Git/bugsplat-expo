[![bugsplat-github-banner-basic-outline](https://user-images.githubusercontent.com/20464226/149019306-3186103c-5315-4dad-a499-4fd1df408475.png)](https://bugsplat.com)
<br/>

# <div align="center">BugSplat</div>

### **<div align="center">Crash and error reporting built for busy developers.</div>**

<div align="center">
    <a href="https://bsky.app/profile/bugsplatco.bsky.social"><img alt="Follow BugSplat on Bluesky" src="https://img.shields.io/badge/Follow%20BugSplat-Bluesky-blue?logo=bluesky&style=social"></a>
    <a href="https://discord.gg/K4KjjRV5ve"><img alt="Join BugSplat on Discord" src="https://img.shields.io/discord/664965194799251487?label=Join%20Discord&logo=Discord&style=social"></a>
    <br/>
    <a href="https://www.npmjs.com/package/@bugsplat/expo"><img alt="@bugsplat/expo on npm" src="https://img.shields.io/npm/v/@bugsplat/expo?label=npm&logo=npm"></a>
</div>

## Introduction

BugSplat's `@bugsplat/expo` package provides crash and error reporting for Expo apps across iOS, Android, and Web. BugSplat provides you with invaluable insight into the issues tripping up your users. Our Expo integration collects native crash reports, JavaScript errors, and custom metadata so that you can fix bugs and deliver a better user experience.

## Installation

```sh
npx expo install @bugsplat/expo
```

## Configuration

Add the config plugin to your `app.json` or `app.config.js`:

Credentials for symbol upload can be set via environment variables (`BUGSPLAT_CLIENT_ID`, `BUGSPLAT_CLIENT_SECRET`) or in the plugin config.

```json
{
  "expo": {
    "plugins": [
      ["@bugsplat/expo", {
        "database": "your-database",
        "enableSymbolUpload": true
      }],
      ["expo-build-properties", {
        "android": {
          "minSdkVersion": 26
        }
      }]
    ]
  }
}
```

The `bugsplat-android` SDK requires Android minSdk 26 (Android 8.0+). If your project's minSdk is already >= 26, the `expo-build-properties` plugin is not needed.

The plugin sets up required native permissions (Android) and optionally configures automatic symbol uploads for both platforms. Configure your database in code via `init()`.

### Plugin Options

| Option | Required | Description |
|--------|----------|-------------|
| `database` | No | BugSplat database name (can also be set via `init()` or `BUGSPLAT_DATABASE` env var) |
| `enableSymbolUpload` | No | Enable automatic symbol upload for iOS (dSYMs) and Android (.so files) |
| `symbolUploadClientId` | No | BugSplat API client ID (or set `BUGSPLAT_CLIENT_ID` env var) |
| `symbolUploadClientSecret` | No | BugSplat API client secret (or set `BUGSPLAT_CLIENT_SECRET` env var) |

### Symbol Upload

Production crash reports require debug symbols to produce readable stack traces. When `enableSymbolUpload` is set, the config plugin automatically uploads symbols during iOS and Android release builds.

For manual uploads or CI/CD workflows, use [`@bugsplat/symbol-upload`](https://github.com/BugSplat-Git/symbol-upload) directly:

```sh
npm install --save-dev @bugsplat/symbol-upload
```

```sh
# Upload iOS dSYMs
npx @bugsplat/symbol-upload \
  -b your-database -a YourApp -v 1.0.0 \
  -i $BUGSPLAT_CLIENT_ID -s $BUGSPLAT_CLIENT_SECRET \
  -d /path/to/build/Products/Release-iphoneos \
  -f "**/*.dSYM"

# Upload Android .so files (converted to .sym)
npx @bugsplat/symbol-upload \
  -b your-database -a YourApp -v 1.0.0 \
  -i $BUGSPLAT_CLIENT_ID -s $BUGSPLAT_CLIENT_SECRET \
  -d android/app/build/intermediates/merged_native_libs \
  -f "**/*.so" -m

# Upload JavaScript source maps (after npx expo export --source-maps)
npx @bugsplat/symbol-upload \
  -b your-database -a YourApp -v 1.0.0 \
  -i $BUGSPLAT_CLIENT_ID -s $BUGSPLAT_CLIENT_SECRET \
  -d dist \
  -f "**/*.map"
```

Run `npx @bugsplat/symbol-upload --help` for all options.

## Usage

### Initialize

```typescript
import { init } from '@bugsplat/expo';

await init('your-database', 'YourApp', '1.0.0', {
  userName: 'user@example.com',
  userEmail: 'user@example.com',
  appKey: 'optional-key',
});
```

### Report Errors

```typescript
import { post } from '@bugsplat/expo';

try {
  riskyOperation();
} catch (error) {
  const result = await post(error);
  console.log(result.success ? 'Reported!' : result.error);
}
```

### Set User Info

```typescript
import { setUser } from '@bugsplat/expo';

setUser('Jane Doe', 'jane@example.com');
```

### Set Custom Attributes

```typescript
import { setAttribute } from '@bugsplat/expo';

setAttribute('environment', 'production');
```

### Test Crash

```typescript
import { crash } from '@bugsplat/expo';

// Triggers a native crash (iOS/Android) or throws an error (web)
crash();
```

### Error Boundary

Wrap your component tree in `<ErrorBoundary>` to catch React render errors and report them to BugSplat automatically. This works on all platforms — iOS, Android, and Web.

```tsx
import { ErrorBoundary } from '@bugsplat/expo';

function App() {
  return (
    <ErrorBoundary fallback={<Text>Something went wrong</Text>}>
      <MyComponent />
    </ErrorBoundary>
  );
}
```

The fallback prop accepts a React node or a render function:

```tsx
<ErrorBoundary
  fallback={({ error, resetErrorBoundary }) => (
    <View>
      <Text>{error.message}</Text>
      <Button title="Try again" onPress={resetErrorBoundary} />
    </View>
  )}
>
  <MyComponent />
</ErrorBoundary>
```

On **iOS and Android**, the ErrorBoundary reports errors through the native Expo module. On **Web**, it uses `@bugsplat/react`.

## How It Works

| Platform | Native Crashes | JS Error Reporting |
|----------|---------------|-------------------|
| **iOS** | [bugsplat-apple](https://github.com/BugSplat-Git/bugsplat-apple) (PLCrashReporter) | HTTP POST to `/post/js/` |
| **Android** | [bugsplat-android](https://github.com/BugSplat-Git/bugsplat-android) (Crashpad) | HTTP POST to `/post/js/` |
| **Web** | N/A | [bugsplat-js](https://github.com/BugSplat-Git/bugsplat-js) |

## API

### `init(database, application, version, options?)`

Initialize BugSplat crash reporting. Must be called before other functions.

**Options:**
- `appKey?: string` - Queryable metadata key
- `userName?: string` - User name for reports
- `userEmail?: string` - User email for reports
- `autoSubmitCrashReport?: boolean` - Auto-submit crashes (iOS only, default: true)
- `attributes?: Record<string, string>` - Custom key-value attributes
- `attachments?: string[]` - File paths to attach (native only)
- `description?: string` - Default description

### `post(error, options?)`

Manually report an error. Returns `{ success: boolean, error?: string }`.

### `setUser(name, email)`

Update user info for subsequent reports.

### `setAttribute(key, value)`

Set a custom attribute. Note: not supported on web.

### `crash()`

Trigger a test crash to verify integration.

## Testing Native Crashes

To test native crash reporting, you must run a **release build** — the debugger intercepts crashes in debug builds.

```sh
# iOS
npx expo run:ios --configuration Release

# Android
npx expo run:android --variant release
```

**iOS**: Crash reports are captured at crash time by PLCrashReporter and **uploaded on the next app launch** when `init()` is called again. After triggering a test crash, relaunch the app and call `init()` to upload the pending report.

**Android**: Crash reports are captured and **uploaded immediately at crash time** by the Crashpad handler process.

## Troubleshooting

### Android: Crashes not uploading on emulator

The Crashpad handler process requires native libraries to be extracted to disk. The `@bugsplat/expo` config plugin sets `extractNativeLibs=true` automatically. If you're still not seeing crashes:

- Use a **`google_apis`** emulator image (not `google_apis_playstore`). The Play Store emulator images have restrictions that prevent Crashpad's handler process from executing.
- Alternatively, test on a **physical Android device** where this is not an issue.

### iOS: No crash report after test crash

Make sure you **relaunch the app and call `init()` again** after the crash. PLCrashReporter saves the crash to disk and uploads it on the next launch.

## License

MIT
