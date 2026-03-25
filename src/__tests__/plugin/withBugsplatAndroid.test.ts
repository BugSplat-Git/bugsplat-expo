import { AndroidConfig } from 'expo/config-plugins';
import { withBugsplatAndroid, buildAndroidGradleTask } from '../../../plugin/src/withBugsplatAndroid';

const mockWithAndroidManifest = jest.fn((config: any, callback: any) => {
  const modConfig = {
    ...config,
    modResults: {
      manifest: {
        application: [{ $: {} }],
      },
    },
  };
  return callback(modConfig);
});

const mockWithAppBuildGradle = jest.fn((config: any, _callback: any) => config);

jest.mock('expo/config-plugins', () => {
  const actual = jest.requireActual('expo/config-plugins');
  return {
    ...actual,
    AndroidConfig: {
      ...actual.AndroidConfig,
      Permissions: {
        withPermissions: jest.fn((config: any, _permissions: any) => config),
      },
    },
    withAndroidManifest: (a: any, b: any) => mockWithAndroidManifest(a, b),
    withAppBuildGradle: (a: any, b: any) => mockWithAppBuildGradle(a, b),
  };
});

describe('withBugsplatAndroid', () => {
  const baseConfig: any = {
    name: 'TestApp',
    slug: 'test-app',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds INTERNET and ACCESS_NETWORK_STATE permissions', () => {
    withBugsplatAndroid(baseConfig, {});
    expect(AndroidConfig.Permissions.withPermissions).toHaveBeenCalledWith(
      baseConfig,
      [
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
      ]
    );
  });

  it('sets extractNativeLibs to true for Crashpad handler', () => {
    const result: any = withBugsplatAndroid(baseConfig, {});
    expect(result.modResults.manifest.application[0].$['android:extractNativeLibs']).toBe('true');
  });

  it('does not add Gradle task when enableSymbolUpload is false', () => {
    withBugsplatAndroid(baseConfig, {});
    expect(mockWithAppBuildGradle).not.toHaveBeenCalled();
  });

  it('adds Gradle task when enableSymbolUpload is true', () => {
    withBugsplatAndroid(baseConfig, {
      enableSymbolUpload: true,
      database: 'my-db',
      symbolUploadClientId: 'client-id',
      symbolUploadClientSecret: 'client-secret',
    });
    expect(mockWithAppBuildGradle).toHaveBeenCalled();
  });
});

describe('buildAndroidGradleTask', () => {
  it('registers uploadBugsplatSymbols task', () => {
    const task = buildAndroidGradleTask({ database: 'my-db' });
    expect(task).toContain('uploadBugsplatSymbols');
    expect(task).toContain('Exec::class');
  });

  it('uses npx @bugsplat/symbol-upload with -m flag', () => {
    const task = buildAndroidGradleTask({ database: 'my-db' });
    expect(task).toContain('@bugsplat/symbol-upload');
    expect(task).toContain('"-m"');
  });

  it('includes database from props', () => {
    const task = buildAndroidGradleTask({ database: 'my-db' });
    expect(task).toContain('"my-db"');
  });

  it('includes client credentials from props', () => {
    const task = buildAndroidGradleTask({
      database: 'my-db',
      symbolUploadClientId: 'test-id',
      symbolUploadClientSecret: 'test-secret',
    });
    expect(task).toContain('"test-id"');
    expect(task).toContain('"test-secret"');
  });

  it('falls back to env vars when credentials are not provided', () => {
    const task = buildAndroidGradleTask({});
    expect(task).toContain('System.getenv("BUGSPLAT_CLIENT_ID")');
    expect(task).toContain('System.getenv("BUGSPLAT_CLIENT_SECRET")');
    expect(task).toContain('System.getenv("BUGSPLAT_DATABASE")');
  });

  it('uploads .so files', () => {
    const task = buildAndroidGradleTask({ database: 'my-db' });
    expect(task).toContain('**/*.so');
  });
});
