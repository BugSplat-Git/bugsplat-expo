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
    // Plugin type makes database required, but the iOS helper still tolerates
    // missing values at this level (top-level validation throws upstream); cast
    // through `any` to exercise that branch directly.
    withBugsplatIos(baseConfig, {} as any);
    expect(mockWithInfoPlist).not.toHaveBeenCalled();
  });

  it('does not add symbol upload phase when enableSymbolUpload is false', () => {
    withBugsplatIos(baseConfig, { database: 'my-db' });
    expect(mockWithXcodeProject).not.toHaveBeenCalled();
  });

  it('adds symbol upload phase when enableSymbolUpload is true', () => {
    withBugsplatIos(baseConfig, {
      database: 'my-db',
      enableSymbolUpload: true,
      symbolUploadClientId: 'client-id',
      symbolUploadClientSecret: 'client-secret',
    });
    expect(mockWithXcodeProject).toHaveBeenCalled();
  });
});

describe('buildIosUploadScript', () => {
  it('uses npx --yes @bugsplat/symbol-upload', () => {
    const script = buildIosUploadScript({
      database: 'my-db',
      symbolUploadClientId: 'test-id',
      symbolUploadClientSecret: 'test-secret',
    }, 'TestApp', '1.0.0');
    expect(script).toContain('npx --yes @bugsplat/symbol-upload');
  });

  it('includes database, client ID, and client secret from props', () => {
    const script = buildIosUploadScript({
      database: 'my-db',
      symbolUploadClientId: 'test-id',
      symbolUploadClientSecret: 'test-secret',
    }, 'TestApp', '1.0.0');
    expect(script).toContain('my-db');
    expect(script).toContain('test-id');
    expect(script).toContain('test-secret');
  });

  it('falls back to env vars when credentials are not provided', () => {
    const script = buildIosUploadScript({ database: 'my-db' }, 'TestApp', '1.0.0');
    expect(script).toContain('${BUGSPLAT_CLIENT_ID}');
    expect(script).toContain('${BUGSPLAT_CLIENT_SECRET}');
  });

  it('throws if database is missing — prevents emitting -b "undefined"', () => {
    expect(() => buildIosUploadScript({} as any, 'TestApp', '1.0.0')).toThrow(/database/);
  });

  it('throws if database is whitespace-only', () => {
    expect(() => buildIosUploadScript({ database: '   ' }, 'TestApp', '1.0.0')).toThrow(/database/);
  });

  it('throws if appName/appVersion are missing — no embedded "undefined"', () => {
    expect(() => buildIosUploadScript({ database: 'db' }, '', '1.0.0')).toThrow();
    expect(() => buildIosUploadScript({ database: 'db' }, 'App', '')).toThrow();
  });

  it('uses the provided appName / appVersion (not Xcode build vars)', () => {
    const script = buildIosUploadScript({ database: 'my-db' }, 'MyApp', '2.3.4');
    expect(script).toContain('"MyApp"');
    expect(script).toContain('"2.3.4"');
  });

  it('only runs on Release configuration', () => {
    const script = buildIosUploadScript({ database: 'my-db' }, 'TestApp', '1.0.0');
    expect(script).toContain('${CONFIGURATION}');
    expect(script).toContain('Release');
  });

  it('uploads dSYM files', () => {
    const script = buildIosUploadScript({ database: 'my-db' }, 'TestApp', '1.0.0');
    expect(script).toContain('**/*.dSYM');
    expect(script).toContain('${DWARF_DSYM_FOLDER_PATH}');
  });

  it('includes npx availability check and graceful fallback', () => {
    const script = buildIosUploadScript({ database: 'my-db' }, 'TestApp', '1.0.0');
    expect(script).toContain('command -v npx');
    expect(script).toContain('warning: npx not found');
    expect(script).toContain('exit 0');
  });
});
