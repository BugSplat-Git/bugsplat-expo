// Covers the top-level plugin's fail-fast validation: database, app metadata,
// and symbol-upload credential checks. These guarantee misconfiguration trips
// at `expo prebuild` time with an actionable message rather than producing a
// silently-broken native project.

jest.mock('expo/config-plugins', () => {
  const actual = jest.requireActual('expo/config-plugins');
  return {
    ...actual,
    createRunOncePlugin: (fn: any, _name: string, _version: string) => fn,
    withInfoPlist: (config: any, _cb: any) => config,
    withXcodeProject: (config: any, _cb: any) => config,
    withDangerousMod: (config: any, _spec: any) => config,
    withAndroidManifest: (config: any, _cb: any) => config,
    withAppBuildGradle: (config: any, _cb: any) => config,
    AndroidConfig: {
      ...actual.AndroidConfig,
      Permissions: {
        withPermissions: (config: any, _perms: any) => config,
      },
    },
  };
});

import withBugsplat from '../../../plugin/src/index';

const baseConfig: any = {
  name: 'TestApp',
  version: '1.0.0',
  android: { package: 'com.example.test' },
};

describe('plugin top-level validation', () => {
  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('database', () => {
    it('throws when database is missing', () => {
      expect(() => (withBugsplat as any)(baseConfig, {})).toThrow(/database.*required/);
    });

    it('throws when database is undefined / not a string', () => {
      expect(() => (withBugsplat as any)(baseConfig, { database: undefined })).toThrow(/database.*required/);
      expect(() => (withBugsplat as any)(baseConfig, { database: 42 as any })).toThrow(/database.*required/);
    });

    it('throws when database is whitespace-only', () => {
      expect(() => (withBugsplat as any)(baseConfig, { database: '   ' })).toThrow(/database.*required/);
    });

    it('throws when database is the angle-bracket placeholder', () => {
      expect(() => (withBugsplat as any)(baseConfig, { database: '<your-database>' })).toThrow(/placeholder/);
    });

    it('accepts a real database value', () => {
      expect(() => (withBugsplat as any)(baseConfig, { database: 'my-db' })).not.toThrow();
    });

    it('normalizes a value with surrounding whitespace', () => {
      // Trimming-then-validation should pass and downstream consumers receive
      // the trimmed value (we can't observe options out, but exercising the
      // path proves the trim doesn't throw before the placeholder check).
      expect(() => (withBugsplat as any)(baseConfig, { database: '  my-db  ' })).not.toThrow();
    });
  });

  describe('app metadata', () => {
    it('throws when expo.version is missing', () => {
      expect(() => (withBugsplat as any)({ ...baseConfig, version: undefined }, { database: 'db' })).toThrow(/version.*required/);
    });

    it('throws when expo.name is missing', () => {
      expect(() => (withBugsplat as any)({ ...baseConfig, name: undefined }, { database: 'db' })).toThrow(/name.*required/);
    });

    it('throws when expo.android.package is missing on a project targeting Android', () => {
      expect(() => (withBugsplat as any)({ ...baseConfig, android: {} }, { database: 'db' })).toThrow(/android\.package/);
    });

    it('does NOT require expo.android.package when no android block is declared (iOS-only)', () => {
      expect(() => (withBugsplat as any)({ ...baseConfig, android: undefined }, { database: 'db' })).not.toThrow();
    });
  });

  describe('symbol upload credentials', () => {
    it('throws when enableSymbolUpload is true and credentials are missing entirely', () => {
      delete process.env.BUGSPLAT_CLIENT_ID;
      delete process.env.BUGSPLAT_CLIENT_SECRET;
      expect(() => (withBugsplat as any)(baseConfig, { database: 'db', enableSymbolUpload: true })).toThrow(/credentials are missing/);
    });

    it('throws when credentials are whitespace-only — trimmed-empty must count as missing', () => {
      expect(() => (withBugsplat as any)(baseConfig, {
        database: 'db',
        enableSymbolUpload: true,
        symbolUploadClientId: '   ',
        symbolUploadClientSecret: '   ',
      })).toThrow(/credentials are missing/);
    });

    it('throws when env vars are whitespace-only', () => {
      process.env.BUGSPLAT_CLIENT_ID = '   ';
      process.env.BUGSPLAT_CLIENT_SECRET = '   ';
      expect(() => (withBugsplat as any)(baseConfig, { database: 'db', enableSymbolUpload: true })).toThrow(/credentials are missing/);
    });

    it('accepts credentials from app.json props', () => {
      expect(() => (withBugsplat as any)(baseConfig, {
        database: 'db',
        enableSymbolUpload: true,
        symbolUploadClientId: 'id',
        symbolUploadClientSecret: 'secret',
      })).not.toThrow();
    });

    it('accepts credentials from env vars when not in app.json', () => {
      process.env.BUGSPLAT_CLIENT_ID = 'env-id';
      process.env.BUGSPLAT_CLIENT_SECRET = 'env-secret';
      expect(() => (withBugsplat as any)(baseConfig, { database: 'db', enableSymbolUpload: true })).not.toThrow();
    });

    it('does not require credentials when enableSymbolUpload is omitted', () => {
      delete process.env.BUGSPLAT_CLIENT_ID;
      delete process.env.BUGSPLAT_CLIENT_SECRET;
      expect(() => (withBugsplat as any)(baseConfig, { database: 'db' })).not.toThrow();
    });
  });
});
