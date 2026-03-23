import { withBugsplatIos } from '../../../plugin/src/withBugsplatIos';

const mockWithXcodeProject = jest.fn((config: any, _callback: any) => config);

jest.mock('expo/config-plugins', () => {
  const actual = jest.requireActual('expo/config-plugins');
  return {
    ...actual,
    withInfoPlist: jest.fn((config: any, callback: any) => {
      const modConfig = {
        ...config,
        modResults: { ...(config.modResults || {}) },
      };
      return callback(modConfig);
    }),
    withXcodeProject: (a: any, b: any) => mockWithXcodeProject(a, b),
  };
});

describe('withBugsplatIos', () => {
  const baseConfig: any = {
    name: 'TestApp',
    slug: 'test-app',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds BugSplatDatabase to Info.plist', () => {
    const result: any = withBugsplatIos(baseConfig, { database: 'my-db' });
    expect(result.modResults.BugSplatDatabase).toBe('my-db');
  });

  it('does not add dSYM upload phase when enableDsymUpload is false', () => {
    withBugsplatIos(baseConfig, { database: 'my-db' });
    expect(mockWithXcodeProject).not.toHaveBeenCalled();
  });

  it('adds dSYM upload phase when enableDsymUpload is true', () => {
    withBugsplatIos(baseConfig, {
      database: 'my-db',
      enableDsymUpload: true,
      symbolUploadClientId: 'client-id',
      symbolUploadClientSecret: 'client-secret',
    });
    expect(mockWithXcodeProject).toHaveBeenCalled();
  });
});
