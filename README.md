# @bugsplat/expo

[BugSplat](https://bugsplat.com) crash and error reporting for Expo apps across iOS, Android, and Web.

## Installation

```sh
npx expo install @bugsplat/expo
```

For web error boundary support, also install the optional peer dependency:

```sh
npm install @bugsplat/react
```

## Configuration

Add the config plugin to your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "plugins": [
      "@bugsplat/expo",
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

The plugin sets up required native permissions (Android) and optionally configures dSYM uploads (iOS). Configure your database in code via `init()`.

### Plugin Options

| Option | Required | Description |
|--------|----------|-------------|
| `enableDsymUpload` | No | Add an Xcode build phase to upload dSYMs on release builds |
| `symbolUploadClientId` | No | BugSplat API client ID for symbol upload |
| `symbolUploadClientSecret` | No | BugSplat API client secret for symbol upload |

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

### Web Error Boundary (requires `@bugsplat/react`)

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

## License

MIT
