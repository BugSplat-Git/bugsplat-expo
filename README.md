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

Wrap your component tree in `<ErrorBoundary>` to catch React render errors and report them to BugSplat automatically. Works identically on iOS, Android, and Web.

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

### Collecting user input before posting

By default, `<ErrorBoundary>` posts to BugSplat the moment it catches an error. If you'd rather give the user a chance to describe what they were doing first — and bundle that into a single report instead of two — set `disablePost` on the boundary and post manually from your fallback:

`<ErrorBoundary>` is a class component, so hooks can't live directly inside its `fallback` render prop — extract the fallback into its own functional component:

```tsx
import { useRef, useState } from 'react';
import { ErrorBoundary, post, type FallbackProps } from '@bugsplat/expo';
import { Text, TextInput, Button, View } from 'react-native';

function ErrorFallback({ error, componentStack, resetErrorBoundary }: FallbackProps) {
  const [description, setDescription] = useState('');
  const posted = useRef(false);

  const submit = async () => {
    if (posted.current) return;
    posted.current = true;
    await post(error, {
      description,
      attributes: { route: 'tasks/123' },
      attachments: componentStack
        ? [{
            filename: 'componentStack.txt',
            data: new Blob([componentStack], { type: 'text/plain' }),
          }]
        : undefined,
    });
  };

  return (
    <View>
      <Text>Something went wrong: {error.message}</Text>
      <TextInput value={description} onChangeText={setDescription} />
      <Button title="Submit" onPress={submit} />
      <Button title="Dismiss" onPress={() => { submit(); resetErrorBoundary(); }} />
    </View>
  );
}

<ErrorBoundary disablePost fallback={(props) => <ErrorFallback {...props} />}>
  <App />
</ErrorBoundary>
```

A few notes on this pattern:

- `post()` is **not** idempotent. The `useRef` guard is the consumer's responsibility — without it, a fast double-tap (or "Submit then Dismiss") would fire two reports. `useRef` updates synchronously, so it guards taps that land in the same render window; `useState` would not.
- `componentStack` is wrapped in a `Blob`. This works cross-platform because `@bugsplat/expo` includes `expo-blob`, which polyfills the web-standard `Blob` API on native.
- `attributes` becomes a queryable column in the BugSplat dashboard — useful for filtering crashes by route, feature flag, build channel, etc.
- If posting fails and you want retry, check the `success` property of the value returned by `post()` and reset `posted.current` accordingly. The recipe doesn't show this to keep it minimal.

### User Feedback

Submit user feedback tied to your BugSplat database. Works on iOS, Android, and Web.

Imperative API — call from anywhere after `init()`:

```typescript
import { postFeedback } from '@bugsplat/expo';

const result = await postFeedback('Login button broken', {
  description: 'Nothing happens when I tap sign in',
});
console.log(result.success ? `Feedback #${result.crashId} posted` : result.error);
```

React hook — useful for driving a feedback form with built-in loading/error state:

```tsx
import { useFeedback } from '@bugsplat/expo';

function FeedbackForm() {
  const { postFeedback, loading, error } = useFeedback();

  return (
    <Button
      title={loading ? 'Sending…' : 'Send feedback'}
      disabled={loading}
      onPress={() =>
        postFeedback('Login button broken', {
          description: 'Nothing happens when I tap sign in',
        })
      }
    />
  );
}
```

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

### `postFeedback(title, options?)`

Submit user feedback. `title` is a short summary (required); `options.description` holds the longer body. Returns `{ success: boolean, error?: string, crashId?: number }`.

### `useFeedback()`

React hook returning `{ postFeedback, loading, response, error }` for driving feedback forms.

### `ErrorBoundary`

React error boundary that reports render errors to BugSplat automatically. Accepts a `fallback` (ReactNode or render function receiving `{ error, componentStack, response, resetErrorBoundary }`).

### `setUser(name, email)`

Update user info for subsequent reports.

### `setAttribute(key, value)`

Set a custom attribute. Note: not supported on web.

### `crash()`

Trigger a test crash to verify integration.

## Expo Go

`@bugsplat/expo` works in Expo Go with reduced functionality. Since native modules are not available in Expo Go, native crash reporting is disabled. JS error reporting (`init()`, `post()`, `postFeedback()`, `setUser()`, `setAttribute()`, `ErrorBoundary`) still works via an HTTP fallback. A warning is logged at `init()` to let you know native crash reporting is inactive.

To test full native crash reporting, use a **release build** (see [Testing Native Crashes](#testing-native-crashes) below). Development builds include a debugger that intercepts crashes before BugSplat can capture them.

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
