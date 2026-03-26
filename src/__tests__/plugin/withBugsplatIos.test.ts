import { withBugsplatIos, buildIosUploadScript } from '../../../plugin/src/withBugsplatIos';

const mockWithInfoPlist = jest.fn((config: any, callback: any) => {
  const modConfig = {
    ...config,
    modResults: { ...(config.modResults || {}) },
  };
  return callback(modConfig);
});

const mockWithXcodeProject = jest.fn((config: any, _callback: any) => config);

jest.mock('expo/config-plugins', () => {
  const actual = jest.requireActual('expo/config-plugins');
  return {
    ...actual,
    withInfoPlist: (a: any, b: any) => mockWithInfoPlist(a, b),
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

  it('adds BugSplatDatabase to Info.plist when database is provided', () => {
    const result: any = withBugsplatIos(baseConfig, { database: 'my-db' });
    expect(result.modResults.BugSplatDatabase).toBe('my-db');
  });

  it('does not modify Info.plist when database is not provided', () => {
    withBugsplatIos(baseConfig, {});
    expect(mockWithInfoPlist).not.toHaveBeenCalled();
  });

  it('does not add symbol upload phase when enableSymbolUpload is false', () => {
    withBugsplatIos(baseConfig, {});
    expect(mockWithXcodeProject).not.toHaveBeenCalled();
  });

  it('adds symbol upload phase when enableSymbolUpload is true', () => {
    withBugsplatIos(baseConfig, {
      enableSymbolUpload: true,
      symbolUploadClientId: 'client-id',
      symbolUploadClientSecret: 'client-secret',
    });
    expect(mockWithXcodeProject).toHaveBeenCalled();
  });
});

describe('buildIosUploadScript', () => {
  it('uses npx @bugsplat/symbol-upload with --yes flag', () => {
    const script = buildIosUploadScript({
      database: 'my-db',
      symbolUploadClientId: 'test-id',
      symbolUploadClientSecret: 'test-secret',
    });
    expect(script).toContain('npx --yes @bugsplat/symbol-upload');
  });

  it('includes database, client ID, and client secret from props', () => {
    const script = buildIosUploadScript({
      database: 'my-db',
      symbolUploadClientId: 'test-id',
      symbolUploadClientSecret: 'test-secret',
    });
    expect(script).toContain('my-db');
    expect(script).toContain('test-id');
    expect(script).toContain('test-secret');
  });

  it('falls back to env vars when credentials are not provided', () => {
    const script = buildIosUploadScript({});
    expect(script).toContain('${BUGSPLAT_CLIENT_ID}');
    expect(script).toContain('${BUGSPLAT_CLIENT_SECRET}');
    expect(script).toContain('${BUGSPLAT_DATABASE}');
  });

  it('only runs on Release configuration', () => {
    const script = buildIosUploadScript({ database: 'my-db' });
    expect(script).toContain('${CONFIGURATION}');
    expect(script).toContain('Release');
  });

  it('uploads dSYM files', () => {
    const script = buildIosUploadScript({ database: 'my-db' });
    expect(script).toContain('**/*.dSYM');
    expect(script).toContain('${DWARF_DSYM_FOLDER_PATH}');
  });

  it('includes npx availability check and graceful fallback', () => {
    const script = buildIosUploadScript({ database: 'my-db' });
    expect(script).toContain('command -v npx');
    expect(script).toContain('warning: npx not found');
    expect(script).toContain('exit 0');
  });
});
