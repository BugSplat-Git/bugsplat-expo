import { AndroidConfig } from 'expo/config-plugins';
import { withBugsplatAndroid } from '../../../plugin/src/withBugsplatAndroid';

jest.mock('expo/config-plugins', () => {
  const actual = jest.requireActual('expo/config-plugins');
  return {
    ...actual,
    AndroidConfig: {
      ...actual.AndroidConfig,
      Permissions: {
        withPermissions: jest.fn((config, _permissions) => config),
      },
    },
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
    withBugsplatAndroid(baseConfig, { database: 'my-db' });
    expect(AndroidConfig.Permissions.withPermissions).toHaveBeenCalledWith(
      baseConfig,
      [
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
      ]
    );
  });
});
