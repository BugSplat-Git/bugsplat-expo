import { AndroidConfig } from 'expo/config-plugins';
import { withBugsplatAndroid } from '../../../plugin/src/withBugsplatAndroid';

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
});
